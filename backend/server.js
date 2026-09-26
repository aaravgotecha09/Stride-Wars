import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'] },
});

// ---------------- Config ----------------
const GRID_SIZE = 12;
const TEAMS = ['red', 'blue', 'gold'];
const TICK_MS = 1000;
const MAX_SPEED_CELLS_PER_SEC = 3.5; // simulated-GPS anti-cheat: caps at a hard run pace
const CAPTURE_RATE = 3;              // meter gain per tick while a lone team holds a zone
const CONTEST_DECAY = 5;             // meter loss per tick while an attacker contests
const IDLE_DECAY = 1;                // meter loss per tick while a zone sits empty
const XP_PER_TICK_HOLD = 1;
const XP_ON_CAPTURE = 25;

// ---------------- State ----------------
const zones = new Map(); // key "x,y" -> { x, y, owner, meter }
for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    zones.set(`${x},${y}`, { x, y, owner: null, meter: 0 });
  }
}

const players = new Map(); // socket.id -> player

function assignTeam() {
  const counts = { red: 0, blue: 0, gold: 0 };
  for (const p of players.values()) counts[p.team]++;
  return Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
}

function cellKey(x, y) {
  return `${Math.round(x)},${Math.round(y)}`;
}

function serializeState() {
  return {
    zones: Array.from(zones.values()),
    players: Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      xp: p.xp,
    })),
  };
}

function leaderboard() {
  const byPlayer = Array.from(players.values())
    .map((p) => ({ name: p.name, team: p.team, xp: p.xp }))
    .sort((a, b) => b.xp - a.xp);
  const byTeam = { red: 0, blue: 0, gold: 0 };
  for (const z of zones.values()) if (z.owner) byTeam[z.owner]++;
  return { byPlayer, byTeam };
}

io.on('connection', (socket) => {
  socket.on('join', ({ name }) => {
    const team = assignTeam();
    const player = {
      id: socket.id,
      name: (name || 'Runner').toString().slice(0, 16),
      team,
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
      xp: 0,
      lastMoveTs: Date.now(),
    };
    players.set(socket.id, player);
    socket.emit('joined', { self: player, gridSize: GRID_SIZE, teams: TEAMS });
    io.emit('state', serializeState());
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
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('state', serializeState());
  });
});

// ---------------- Game tick: capture / decay / XP ----------------
setInterval(() => {
  const occupancy = new Map(); // zoneKey -> { teams: Set, players: [] }
  for (const p of players.values()) {
    const key = cellKey(p.x, p.y);
    if (!occupancy.has(key)) occupancy.set(key, { teams: new Set(), players: [] });
    occupancy.get(key).teams.add(p.team);
    occupancy.get(key).players.push(p);
  }

  for (const [key, zone] of zones.entries()) {
    const occ = occupancy.get(key);

    if (!occ || occ.teams.size === 0) {
      if (zone.owner && zone.meter > 0) {
        zone.meter = Math.max(0, zone.meter - IDLE_DECAY);
        if (zone.meter === 0) zone.owner = null;
      }
      continue;
    }

    if (occ.teams.size > 1) {
      // Standoff: more than one squad standing in the same cell.
      zone.meter = Math.max(0, zone.meter - 1);
      if (zone.meter === 0) zone.owner = null;
      continue;
    }

    const team = [...occ.teams][0];

    if (!zone.owner || zone.owner === team) {
      const wasOwner = zone.owner === team;
      zone.owner = team;
      const before = zone.meter;
      zone.meter = Math.min(100, zone.meter + CAPTURE_RATE);
      for (const p of occ.players) p.xp += XP_PER_TICK_HOLD;
      if (!wasOwner && before < 100 && zone.meter >= 100) {
        for (const p of occ.players) p.xp += XP_ON_CAPTURE;
      }
    } else {
      zone.meter = Math.max(0, zone.meter - CONTEST_DECAY);
      if (zone.meter === 0) zone.owner = team; // flips to the attacker, builds from here
    }
  }

  io.emit('state', serializeState());
  io.emit('leaderboard', leaderboard());
}, TICK_MS);

app.get('/health', (_req, res) => res.json({ ok: true, players: players.size }));
app.get('/leaderboard', (_req, res) => res.json(leaderboard()));

server.listen(PORT, () => console.log(`StrideWars backend listening on :${PORT}`));
