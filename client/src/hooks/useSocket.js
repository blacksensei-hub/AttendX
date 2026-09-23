import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export function useSocket(sessionId) {
  const socketRef  = useRef(null);
  const token      = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !token) return;

    // No transports restriction: forcing websocket-only put the mobile
    // app into an endless reconnect loop against Render; letting
    // socket.io start on polling and upgrade is reliable there.
    const socket = io(
      import.meta.env.VITE_WS_URL || 'http://localhost:5000',
      {
        auth:              { token },
        reconnectionDelay: 2000,
      }
    );

    socketRef.current = socket;

    // Rooms live on the server per connection, so they are lost on
    // every reconnect. Join on each 'connect', not once, or the live
    // page silently stops receiving scans after a network blip.
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-session', sessionId);
    });
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.emit('leave-session', sessionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  // Stable functions that read the live socket at call time
  const on   = useCallback((event, cb)   => socketRef.current?.on(event, cb), []);
  const off  = useCallback((event)       => socketRef.current?.off(event), []);
  const emit = useCallback((event, data) => socketRef.current?.emit(event, data), []);

  return { connected, on, off, emit };
}
