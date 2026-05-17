require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const initSocket  = require('./config/socket');
const { sequelize } = require('./models');

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

const app    = express();
const server = http.createServer(app);
const io     = initSocket(server);

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) =>
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