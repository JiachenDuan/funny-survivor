import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socket = useMemo(() => io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'), []);
  const [state, setState] = useState(null);

  useEffect(() => {
    socket.on('state', setState);
    return () => {
      socket.off('state', setState);
      socket.disconnect();
    };
  }, [socket]);

  return { socket, state };
}
