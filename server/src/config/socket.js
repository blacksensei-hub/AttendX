// server/src/config/socket.js
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

function initSocket(httpServer) {
  const allowedOrigins = [
    'https://attend-x-iota.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin:      allowedOrigins,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    transports:         ['websocket', 'polling'],
    allowEIO3:          true,
    pingTimeout:        60000,
    pingInterval:       25000,
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

    socket.on('join-session', (sessionId) => {
      socket.join(`session:${sessionId}`);
      console.log(`[Socket] ${socket.user.id} joined session room ${sessionId}`);
    });

    socket.on('leave-session', (sessionId) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('join-class', (classId) => {
      socket.join(`class:${classId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.id} disconnected`);
    });

    // Each user joins their personal notification room
    socket.join(`user:${socket.user.id}`);
  });

  return io;
}

module.exports = initSocket;