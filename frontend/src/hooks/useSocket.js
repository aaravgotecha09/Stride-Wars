import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [self, setSelf] = useState(null);
  const [gridSize, setGridSize] = useState(12);
  const [zones, setZones] = useState([]);
  const [players, setPlayers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [siege, setSiege] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ byPlayer: [], byTeam: {} });
  const [flag, setFlag] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [powerupError, setPowerupError] = useState(null);
  const [radarReveal, setRadarReveal] = useState(null);
  const [workoutMinMs, setWorkoutMinMs] = useState(null);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => setJoinError(err.message));

    socket.on('joined', ({ self, gridSize }) => {
      setSelf(self);
      setGridSize(gridSize);
    });
    socket.on('join_error', ({ error }) => setJoinError(error));

    socket.on('state', ({ zones, players, sectors, siege }) => {
      setZones(zones);
      setPlayers(players);
      setSectors(sectors || []);
      setSiege(siege || null);
    });

    socket.on('leaderboard', (lb) => setLeaderboard(lb));

    socket.on('anticheat_flag', (payload) => {
      setFlag(payload);
      setTimeout(() => setFlag(null), 2500);
    });

    socket.on('powerup_error', ({ error }) => {
      setPowerupError(error);
      setTimeout(() => setPowerupError(null), 3000);
    });

    socket.on('radar_reveal', ({ enemies, expiresInMs }) => {
      setRadarReveal(enemies);
      setTimeout(() => setRadarReveal(null), expiresInMs);
    });

    socket.on('workout_started', ({ minMs }) => setWorkoutMinMs(minMs));

    return () => socket.disconnect();
  }, [token]);

  const deploy = useCallback(() => {
    setJoinError(null);
    socketRef.current?.emit('join');
  }, []);

  const move = useCallback((x, y) => {
    socketRef.current?.emit('move', { x, y });
  }, []);

  const activateShield = useCallback(() => socketRef.current?.emit('activate_shield'), []);
  const activateRadar = useCallback(() => socketRef.current?.emit('activate_radar'), []);
  const activateSecondWind = useCallback(() => socketRef.current?.emit('activate_second_wind'), []);
  const startWorkout = useCallback(() => socketRef.current?.emit('start_fitness_workout'), []);
  const completeWorkout = useCallback(() => socketRef.current?.emit('complete_fitness_workout'), []);

  return {
    connected,
    self,
    gridSize,
    zones,
    players,
    sectors,
    siege,
    leaderboard,
    flag,
    joinError,
    powerupError,
    radarReveal,
    workoutMinMs,
    deploy,
    move,
    activateShield,
    activateRadar,
    activateSecondWind,
    startWorkout,
    completeWorkout,
  };
}
