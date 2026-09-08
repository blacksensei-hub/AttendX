require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const initSocket  = require('./config/socket');
const { sequelize } = require('./models');

const { apiLimiter } = require('./middleware/rateLimiters');

// ─── Routes ──────────────────────────────────────────────────
const authRoutes       = require('./routes/auth');
const classRoutes      = require('./routes/classes');
const sessionRoutes    = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes     = require('./routes/reports');
const notifRoutes      = require('./routes/notifications');
const adminRoutes      = require('./routes/admin');
const appealRoutes     = require('./routes/appeals');
const thresholdRoutes  = require('./routes/thresholds');
const adjustmentRoutes = require('./routes/adjustments');
const scheduleRoutes   = require('./routes/schedules');
const impersonationRoutes = require('./routes/impersonation');

const app    = express();
const server = http.createServer(app);
const io     = initSocket(server);

// ─── Trust proxy ──────────────────────────────────────────────
// REQUIRED on Railway (and any reverse-proxy host). Railway forwards
// requests through its edge proxy, so the real client IP arrives in the
// X-Forwarded-For header rather than on the socket. Setting trust proxy
// to 1 tells Express to use that header for req.ip, which is what the
// rate limiters key off. Without this, every request appears to come from
// Railway's proxy IP — so all users would share one rate-limit bucket
// (locking everyone out at once), and express-rate-limit throws a
// validation error on boot. '1' = trust the first proxy hop (Railway).
app.set('trust proxy', 1);

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());
// ─── CORS ─────────────────────────────────────────────────────
// Accepts a list of allowed origins rather than a single one, so local
// development on the laptop (localhost) and LAN testing from a phone
// (the machine's 192.168.x.x address) can both work at the same time.
//
// Add extra dev origins to CLIENT_URLS in .env as a comma-separated list,
// e.g. CLIENT_URLS=http://localhost:5173,http://192.168.76.166:5173
// CLIENT_URL (singular) is still honoured — it's what production uses.
//
// NOTE: .env changes require a FULL server restart. Nodemon only watches
// js/mjs/cjs/json, and dotenv reads the file once at process start — so
// `rs` or saving a .js file will NOT pick up a new CLIENT_URL.
const allowedOrigins = [
  process.env.CLIENT_URL,
  ...String(process.env.CLIENT_URLS ?? '')
    .split(',')
    .map(o => o.trim()),
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, mobile apps, health probes)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Global rate limiter ──────────────────────────────────────
// Loose per-IP catch-all across the whole API. Stricter, targeted limits
// (e.g. login) are applied on individual routes. Mounted after the body
// parsers but before the routes so every /api request passes through it.
app.use('/api', apiLimiter);

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/classes',       classRoutes);
app.use('/api/sessions',      sessionRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/appeals',       appealRoutes);
app.use('/api/thresholds',    thresholdRoutes);
app.use('/api/adjustments',   adjustmentRoutes);
app.use('/api/schedules',     scheduleRoutes);
// Impersonation lives outside /api/admin because /stop must be callable
// while holding an impersonation token, whose role is the TARGET user's
// (usually student/lecturer) — a router-level authorize('admin') would
// trap admins inside impersonation with no way out. See routes/impersonation.js.
app.use('/api/impersonation', impersonationRoutes);

// ─── Health check ─────────────────────────────────────────────
// Exposed at both paths: /health for platform probes (Railway) and
// /api/health for the client, whose base URL already carries the /api
// prefix (so api.get('/health') resolves to /api/health).
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date() })
);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date() })
);

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Startup ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Verify the database connection before anything else.
    // Throws immediately if PostgreSQL is unreachable so we get a
    // clear error rather than a confusing runtime failure later.
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // We deliberately skip sequelize.sync() here.
    //
    // Sequelize's alter:true mode generates incorrect ALTER TABLE
    // statements due to association ordering — it was creating a
    // foreign key from classes.lecturer_id → appeals instead of
    // classes.lecturer_id → users. All tables already exist and are
    // correct, so there is no need to sync on startup. New tables
    // or columns should be added manually via pgAdmin.
    console.log('✅ Models ready');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      // ── Background scheduler 1: session auto-close ─────────────
      //
      // Polls every 30 seconds and does two things:
      //   1. Finds open sessions whose close_at is within 2 minutes
      //      and sends a "closing soon" email + in-app notification
      //      to all enrolled students.
      //   2. Finds open sessions whose close_at has passed, marks
      //      them as closed, emits a WebSocket event, and sends a
      //      summary email to every enrolled student showing their
      //      attendance status.
      const { startSessionScheduler } = require('./services/sessionScheduler');
      startSessionScheduler(io);

      // ── Background scheduler 2: recurring sessions ─────────────
      //
      // Polls every 60 seconds and does two things:
      //   1. Finds active ClassSchedule entries whose day_of_week
      //      matches today and start_time matches the current minute,
      //      then automatically opens a new session for that class
      //      and sends an "opened" email to enrolled students.
      //   2. Sends a "starting in 10 minutes" reminder email to
      //      enrolled students exactly 10 minutes before each
      //      scheduled slot starts.
      //
      // Uses last_triggered on each schedule to prevent opening the
      // same slot more than once per day, even if the scheduler runs
      // multiple times within the same minute window.
      const { startScheduleRunner } = require('./services/scheduleRunner');
      startScheduleRunner(io);
    });

  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

start();