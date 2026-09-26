import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [self, setSelf] = useState(null);
  const [gridSize, setGridSize] = useState(12);
  const [zones, setZones] = useState([]);
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ byPlayer: [], byTeam: {} });
  const [flag, setFlag] = useState(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('joined', ({ self, gridSize }) => {
      setSelf(self);
      setGridSize(gridSize);
    });

    socket.on('state', ({ zones, players }) => {
      setZones(zones);
      setPlayers(players);
    });

    socket.on('leaderboard', (lb) => setLeaderboard(lb));

    socket.on('anticheat_flag', (payload) => {
      setFlag(payload);
      setTimeout(() => setFlag(null), 2500);
    });

    return () => socket.disconnect();
  }, []);

  const join = useCallback((name) => {
    socketRef.current?.emit('join', { name });
  }, []);

  const move = useCallback((x, y) => {
    socketRef.current?.emit('move', { x, y });
  }, []);

  return { connected, self, gridSize, zones, players, leaderboard, flag, join, move };
}
