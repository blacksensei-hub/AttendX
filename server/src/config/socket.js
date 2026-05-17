const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:  process.env.CLIENT_URL,
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

    // Join a session room (lecturer joins to receive updates)
    socket.on('join-session', (sessionId) => {
      socket.join(`session:${sessionId}`);
      console.log(`[Socket] ${socket.user.id} joined session room ${sessionId}`);
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

    // Each user joins their personal room for notifications
    socket.join(`user:${socket.user.id}`);
  });

  return io;
}

module.exports = initSocket;