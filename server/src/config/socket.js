const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');

// Mirrors the allow-list in app.js. A single CLIENT_URL breaks LAN
// testing: the phone connects from 192.168.x.x while the laptop uses
// localhost, and only one of them can be the configured origin.
const allowedOrigins = [
  process.env.CLIENT_URL,
  ...String(process.env.CLIENT_URLS ?? '')
    .split(',')
    .map(o => o.trim()),
  'http://localhost:5173',
].filter(Boolean);

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        console.warn(`[Socket CORS] Blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
    },
  });

  // ─── Auth middleware ─────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user   = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handling ─────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user.id} connected (${socket.user.role})`);

    // Each user joins their personal room. Joined FIRST so a
    // force-logout can reach them even if they never open a session
    // or class view — a revoked session must be catchable anywhere.
    socket.join(`user:${socket.user.id}`);

    // Join a session room. The room carries every scan in real time
    // (names, emails, student IDs, proxy flags), so only the lecturer
    // who owns the session, or an admin, may join it.
    socket.on('join-session', async (sessionId) => {
      try {
        if (typeof sessionId !== 'string') return;
        if (socket.user.role !== 'admin') {
          const { Session, Class } = require('../models');
          const session = await Session.findByPk(sessionId, { attributes: ['class_id'] });
          const owns = session && await Class.count({
            where: { id: session.class_id, lecturer_id: socket.user.id },
          });
          if (!owns) {
            console.warn(`[Socket] ${socket.user.id} refused session room ${sessionId}`);
            return;
          }
        }
        socket.join(`session:${sessionId}`);
        console.log(`[Socket] ${socket.user.id} joined session room ${sessionId}`);
      } catch (err) {
        console.warn('[Socket] join-session failed:', err.message);
      }
    });

    socket.on('leave-session', (sessionId) => {
      socket.leave(`session:${sessionId}`);
    });

    // Join class room (student joins their enrolled classes)
    socket.on('join-class', (classId) => {
      socket.join(`class:${classId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.id} disconnected`);
    });
  });

  return io;
}

module.exports = initSocket;