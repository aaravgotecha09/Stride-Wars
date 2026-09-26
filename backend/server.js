import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB } from './db.js';
import { authRouter, verifyToken } from './auth.js';
import { User } from './models/User.js';
import { campaignRouter } from './routes/campaignRoutes.js';
import { runTick } from './tick.js';
import {
  GRID_SIZE,
  TEAMS,
  TICK_MS,
  MAX_SPEED_CELLS_PER_SEC,
  RADAR_MAX_CHARGES,
  RADAR_REVEAL_RADIUS,
  RADAR_REVEAL_MS,
  SECOND_WIND_MAX,
  FITNESS_WORKOUT_MIN_MS,
  zones,
  players,
  assignTeam,
  cellKey,
  roleModifiers,
  serializeState,
  leaderboard,
} from './gameState.js';

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

await connectDB(process.env.MONGODB_URI);

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());
app.use('/auth', authRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'] },
});

app.use('/campaign', campaignRouter(io));

// Every socket must carry a valid JWT (issued by /auth/login or /auth/signup)
// before it can join the game.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid or expired session'));
  }
});

io.on('connection', (socket) => {
  socket.on('join', async () => {
    try {
      const dbUser = await User.findById(socket.user.id);
      if (!dbUser) return socket.emit('join_error', { error: 'Account not found.' });

      // Team is assigned once, on a user's first deploy, then persists.
      let team = dbUser.team;
      if (!team) {
        team = assignTeam();
        dbUser.team = team;
        await dbUser.save();
      }

      const player = {
        id: socket.id,
        userId: dbUser._id.toString(),
        name: dbUser.username,
        team,
        role: dbUser.role || null,
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        xp: dbUser.xp,
        startingXp: dbUser.xp,
        lastMoveTs: Date.now(),
        // Power-up state
        shieldCharges: 0,
        shieldHoldZone: null,
        shieldHoldTicks: 0,
        radarCharges: 0,
        distanceSinceRadarCharge: 0,
        secondWindCharges: 0,
        workoutStartedAt: null,
        surgeUntil: null,
        captureTimestamps: [],
      };
      players.set(socket.id, player);
      socket.emit('joined', { self: player, gridSize: GRID_SIZE, teams: TEAMS });
      io.emit('state', serializeState());
    } catch (err) {
      console.error('[StrideWars] join failed:', err.message);
      socket.emit('join_error', { error: 'Could not deploy to the field.' });
    }
  });

  // Simulated GPS position update. The client "walks" the player token toward
  // a clicked destination and streams intermediate coordinates here.
  socket.on('move', ({ x, y }) => {
    const player = players.get(socket.id);
    if (!player) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (x < 0 || y < 0 || x > GRID_SIZE - 1 || y > GRID_SIZE - 1) return;

    const now = Date.now();
    const dt = Math.max((now - player.lastMoveTs) / 1000, 0.05);
    const dist = Math.hypot(x - player.x, y - player.y);
    const speed = dist / dt;

    if (speed > MAX_SPEED_CELLS_PER_SEC) {
      socket.emit('anticheat_flag', {
        reason: 'Movement too fast for walking/jogging pace — position rejected.',
        speed: Number(speed.toFixed(2)),
      });
      return;
    }

    player.x = x;
    player.y = y;
    player.lastMoveTs = now;

    // Radar Ping banking: real (simulated) distance covered fuels the charge.
    const mods = roleModifiers(player.role);
    player.distanceSinceRadarCharge += dist;
    while (player.distanceSinceRadarCharge >= mods.radarChargeDistance && player.radarCharges < RADAR_MAX_CHARGES) {
      player.radarCharges += 1;
      player.distanceSinceRadarCharge -= mods.radarChargeDistance;
    }
  });

  // ---------------- Power-ups ----------------
  socket.on('activate_shield', () => {
    const player = players.get(socket.id);
    if (!player) return;
    const key = cellKey(player.x, player.y);
    const zone = zones.get(key);
    if (!zone || zone.owner !== player.team || zone.meter < 100 || player.shieldCharges <= 0) {
      return socket.emit('powerup_error', {
        error: 'Shield needs a fully captured zone you own and a banked charge.',
      });
    }
    const mods = roleModifiers(player.role);
    zone.shieldUntil = Date.now() + mods.shieldDurationMs;
    player.shieldCharges -= 1;
    io.emit('state', serializeState());
  });

  socket.on('activate_radar', () => {
    const player = players.get(socket.id);
    if (!player) return;
    if (player.radarCharges <= 0) {
      return socket.emit('powerup_error', {
        error: 'No Radar charges banked yet — keep moving to earn one.',
      });
    }
    player.radarCharges -= 1;
    const enemies = Array.from(players.values())
      .filter((p) => p.team !== player.team)
      .filter((p) => Math.hypot(p.x - player.x, p.y - player.y) <= RADAR_REVEAL_RADIUS)
      .map((p) => ({ id: p.id, name: p.name, team: p.team, x: p.x, y: p.y }));
    socket.emit('radar_reveal', { enemies, expiresInMs: RADAR_REVEAL_MS });
    io.emit('state', serializeState());
  });

  socket.on('start_fitness_workout', () => {
    const player = players.get(socket.id);
    if (!player) return;
    player.workoutStartedAt = Date.now();
    socket.emit('workout_started', { minMs: FITNESS_WORKOUT_MIN_MS });
  });

  socket.on('complete_fitness_workout', () => {
    const player = players.get(socket.id);
    if (!player) return;
    if (!player.workoutStartedAt || Date.now() - player.workoutStartedAt < FITNESS_WORKOUT_MIN_MS) {
      return socket.emit('powerup_error', { error: 'Workout not finished yet.' });
    }
    player.workoutStartedAt = null;
    if (player.secondWindCharges < SECOND_WIND_MAX) player.secondWindCharges += 1;
    io.emit('state', serializeState());
  });

  socket.on('activate_second_wind', () => {
    const player = players.get(socket.id);
    if (!player) return;
    const key = cellKey(player.x, player.y);
    const zone = zones.get(key);
    if (!zone || zone.owner !== player.team || player.secondWindCharges <= 0) {
      return socket.emit('powerup_error', {
        error: 'Second Wind needs a zone you own and a banked charge.',
      });
    }
    zone.skipNextDecay = true;
    player.secondWindCharges -= 1;
    io.emit('state', serializeState());
  });

  socket.on('disconnect', async () => {
    const player = players.get(socket.id);
    players.delete(socket.id);
    io.emit('state', serializeState());

    if (player) {
      try {
        // Garrison: a fraction of the session's earned XP converts into
        // banked reserve steps, spendable later via /campaign/garrison.
        const sessionXp = Math.max(0, player.xp - player.startingXp);
        await User.findByIdAndUpdate(player.userId, {
          xp: player.xp,
          team: player.team,
          $inc: { reserveSteps: Math.floor(sessionXp / 2) },
        });
      } catch (err) {
        console.error('[StrideWars] failed to persist player on disconnect:', err.message);
      }
    }
  });
});

setInterval(() => runTick(io), TICK_MS);

app.get('/health', (_req, res) => res.json({ ok: true, players: players.size }));
app.get('/leaderboard', (_req, res) => res.json(leaderboard()));

server.listen(PORT, () => console.log(`StrideWars backend listening on :${PORT}`));
