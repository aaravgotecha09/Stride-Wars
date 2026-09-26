import { computeSectors, getSiegeStatus } from './campaign.js';

// ---------------- Core grid config ----------------
export const GRID_SIZE = 12;
export const TEAMS = ['red', 'blue', 'gold'];
export const ROLES = ['scout', 'defender', 'sprinter'];
export const TICK_MS = 1000;
export const MAX_SPEED_CELLS_PER_SEC = 3.5; // simulated-GPS anti-cheat: caps at a hard run pace

export const CAPTURE_RATE = 3; // meter gain per tick while a lone team holds a zone
export const CONTEST_DECAY = 5; // meter loss per tick while an attacker contests
export const IDLE_DECAY = 1; // meter loss per tick while a zone sits empty
export const XP_PER_TICK_HOLD = 1;
export const XP_ON_CAPTURE = 25;

// ---------------- Power-up tuning ----------------
export const SHIELD_HOLD_SECONDS = 30; // continuous ticks holding a maxed zone to bank a charge
export const SHIELD_MAX_CHARGES = 3;
export const SHIELD_DURATION_MS = 5 * 60 * 1000;
export const DEFENDER_SHIELD_DURATION_MS = 8 * 60 * 1000;

export const SURGE_WINDOW_MS = 120 * 1000; // 2 minutes
export const SURGE_DURATION_MS = 45 * 1000;
export const SURGE_STREAK_DEFAULT = 3;
export const SURGE_STREAK_SPRINTER = 2;
export const SPRINTER_CAPTURE_MULT = 1.2;

export const RADAR_CHARGE_DISTANCE = 12; // grid-units of simulated movement per charge ("~1 virtual km")
export const SCOUT_RADAR_CHARGE_DISTANCE = 6; // scouts bank Radar charges twice as fast
export const RADAR_MAX_CHARGES = 3;
export const RADAR_REVEAL_RADIUS = 5;
export const RADAR_REVEAL_MS = 20 * 1000;

export const SECOND_WIND_MAX = 3;
// Shortened for a usable demo; a real Fitness Mode workout would run longer.
export const FITNESS_WORKOUT_MIN_MS = 60 * 1000;

// ---------------- Live state ----------------
export const zones = new Map(); // key "x,y" -> zone
for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    zones.set(`${x},${y}`, {
      x,
      y,
      owner: null,
      meter: 0,
      shieldUntil: null,
      skipNextDecay: false,
    });
  }
}

export const players = new Map(); // socket.id -> player

export function assignTeam() {
  const counts = { red: 0, blue: 0, gold: 0 };
  for (const p of players.values()) counts[p.team]++;
  return Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
}

export function cellKey(x, y) {
  return `${Math.round(x)},${Math.round(y)}`;
}

// Role-based modifiers feeding the Campus Siege squad roles.
export function roleModifiers(role) {
  if (role === 'defender') {
    return {
      shieldDurationMs: DEFENDER_SHIELD_DURATION_MS,
      captureRateMult: 1,
      surgeStreakNeeded: SURGE_STREAK_DEFAULT,
      radarChargeDistance: RADAR_CHARGE_DISTANCE,
    };
  }
  if (role === 'sprinter') {
    return {
      shieldDurationMs: SHIELD_DURATION_MS,
      captureRateMult: SPRINTER_CAPTURE_MULT,
      surgeStreakNeeded: SURGE_STREAK_SPRINTER,
      radarChargeDistance: RADAR_CHARGE_DISTANCE,
    };
  }
  if (role === 'scout') {
    return {
      shieldDurationMs: SHIELD_DURATION_MS,
      captureRateMult: 1,
      surgeStreakNeeded: SURGE_STREAK_DEFAULT,
      radarChargeDistance: SCOUT_RADAR_CHARGE_DISTANCE,
    };
  }
  return {
    shieldDurationMs: SHIELD_DURATION_MS,
    captureRateMult: 1,
    surgeStreakNeeded: SURGE_STREAK_DEFAULT,
    radarChargeDistance: RADAR_CHARGE_DISTANCE,
  };
}

export function serializeState() {
  return {
    zones: Array.from(zones.values()).map((z) => ({
      x: z.x,
      y: z.y,
      owner: z.owner,
      meter: z.meter,
      shieldUntil: z.shieldUntil || null,
    })),
    players: Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role || null,
      x: p.x,
      y: p.y,
      xp: p.xp,
      shieldCharges: p.shieldCharges || 0,
      radarCharges: p.radarCharges || 0,
      secondWindCharges: p.secondWindCharges || 0,
      surgeUntil: p.surgeUntil || null,
    })),
    sectors: computeSectors(zones, GRID_SIZE),
    siege: getSiegeStatus(),
  };
}

export function leaderboard() {
  const byPlayer = Array.from(players.values())
    .map((p) => ({ name: p.name, team: p.team, role: p.role || null, xp: p.xp }))
    .sort((a, b) => b.xp - a.xp);
  const byTeam = { red: 0, blue: 0, gold: 0 };
  for (const z of zones.values()) if (z.owner) byTeam[z.owner]++;
  return { byPlayer, byTeam };
}
