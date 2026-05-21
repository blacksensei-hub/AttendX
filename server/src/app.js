require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const initSocket  = require('./config/socket');
const { sequelize } = require('./models');
const { User }      = require('./models');

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

app.set('io', io);
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  'https://attend-x-iota.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:          true,
  methods:              ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:       ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
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

// ─── Temporary seed endpoint ──────────────────────────────────
// Hit GET /seed-users once to create demo accounts.
// Remove this after seeding is confirmed.
app.get('/seed-users', async (req, res) => {
  try {
    const users = [
      { name: 'Jeffrey Ankrah',   email: 'jeffreyankrah2004@gmail.com', password: 'Jeffrey@Att2026', role: 'admin'    },
      { name: 'Jeffrey Lecturer', email: 'jeffrey.ankrah18@gmail.com',  password: 'Jeffrey@Lec2026', role: 'lecturer' },
      { name: 'Jeffrey Student',  email: 'ankrahjeffrey21@gmail.com',   password: 'Jeffrey@Stu2026', role: 'student', student_id: 'STU001' },
    ];

    const results = [];
    for (const u of users) {
      const existing = await User.scope('withPassword').findOne({ where: { email: u.email } });
      if (existing) {
        results.push({ email: u.email, status: 'already exists' });
        continue;
      }
      const hash = await bcrypt.hash(u.password, 10);
      await User.create({ ...u, password: hash });
      results.push({ email: u.email, status: 'created' });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[Seed] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ force: false });
    console.log('✅ Tables synced');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      const { startSessionScheduler } = require('./services/sessionScheduler');
      startSessionScheduler(io);

      const { startScheduleRunner } = require('./services/scheduleRunner');
      startScheduleRunner(io);
    });

  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

start();