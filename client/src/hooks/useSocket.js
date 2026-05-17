import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export function useSocket(sessionId) {
  const socketRef  = useRef(null);
  const token      = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !token) return;

    const socket = io(
      import.meta.env.VITE_WS_URL || 'http://localhost:5000',
      {
        auth:              { token },
        transports:        ['websocket'],
        reconnectionDelay: 2000,
      }
    );

    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('join-session', sessionId);

    return () => {
      socket.emit('leave-session', sessionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  const on  = useRef((event, cb) => socketRef.current?.on(event, cb));
  const off = useRef((event)     => socketRef.current?.off(event));
  const emit = useRef((event, data) => socketRef.current?.emit(event, data));

  return {
    connected,
    on:   on.current,
    off:  off.current,
    emit: emit.current,
    socket: socketRef.current,
  };
}