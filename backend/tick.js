import {
  GRID_SIZE,
  CAPTURE_RATE,
  CONTEST_DECAY,
  IDLE_DECAY,
  XP_PER_TICK_HOLD,
  XP_ON_CAPTURE,
  SHIELD_HOLD_SECONDS,
  SHIELD_MAX_CHARGES,
  SURGE_WINDOW_MS,
  SURGE_DURATION_MS,
  zones,
  players,
  cellKey,
  roleModifiers,
  serializeState,
  leaderboard,
} from './gameState.js';
import { maybeResetSiege } from './campaign.js';

export function runTick(io) {
  const now = Date.now();

  if (maybeResetSiege(zones)) {
    io.emit('state', serializeState());
    io.emit('leaderboard', leaderboard());
    return;
  }

  // Shield-hold streaks reset whenever a player leaves the cell they were
  // banking progress in.
  for (const p of players.values()) {
    const currentKey = cellKey(p.x, p.y);
    if (p.shieldHoldZone !== currentKey) {
      p.shieldHoldZone = currentKey;
      p.shieldHoldTicks = 0;
    }
  }

  // Base occupancy: who's really standing where.
  const occupancy = new Map(); // zoneKey -> { teams: Set, playersById: Map }
  function ensure(key) {
    if (!occupancy.has(key)) occupancy.set(key, { teams: new Set(), playersById: new Map() });
    return occupancy.get(key);
  }
  for (const p of players.values()) {
    const occ = ensure(cellKey(p.x, p.y));
    occ.teams.add(p.team);
    occ.playersById.set(p.id, p);
  }

  // Surge: while active, a player's capture presence extends to the 8
  // neighboring cells — a fast lap claims the whole block.
  for (const p of players.values()) {
    if (!p.surgeUntil || p.surgeUntil < now) continue;
    const [cx, cy] = cellKey(p.x, p.y).split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const occ = ensure(`${nx},${ny}`);
        occ.teams.add(p.team);
        occ.playersById.set(p.id, p);
      }
    }
  }

  for (const [key, zone] of zones.entries()) {
    const occ = occupancy.get(key);
    const shielded = Boolean(zone.shieldUntil && now < zone.shieldUntil);

    if (!occ || occ.teams.size === 0) {
      if (zone.skipNextDecay) {
        zone.skipNextDecay = false;
        continue;
      }
      if (!shielded && zone.owner && zone.meter > 0) {
        zone.meter = Math.max(0, zone.meter - IDLE_DECAY);
        if (zone.meter === 0) zone.owner = null;
      }
      continue;
    }

    if (occ.teams.size > 1) {
      // Standoff: more than one squad in the same cell.
      if (zone.skipNextDecay) {
        zone.skipNextDecay = false;
        continue;
      }
      if (!shielded) {
        zone.meter = Math.max(0, zone.meter - 1);
        if (zone.meter === 0) zone.owner = null;
      }
      continue;
    }

    const team = [...occ.teams][0];
    const occPlayers = Array.from(occ.playersById.values());

    if (!zone.owner || zone.owner === team) {
      const wasOwner = zone.owner === team;
      zone.owner = team;
      const before = zone.meter;

      // Sprinters capture faster (role modifier). Rounded to 1 decimal so
      // multiplier math (e.g. 3 * 1.2) doesn't leave float noise in the meter.
      const rawRate = Math.max(...occPlayers.map((p) => CAPTURE_RATE * roleModifiers(p.role).captureRateMult));
      const captureRate = Math.round(rawRate * 10) / 10;
      zone.meter = Math.min(100, Math.round((zone.meter + captureRate) * 10) / 10);

      for (const p of occPlayers) p.xp += XP_PER_TICK_HOLD;

      if (!wasOwner && before < 100 && zone.meter >= 100) {
        for (const p of occPlayers) {
          p.xp += XP_ON_CAPTURE;

          // Surge: a capture streak within the window extends/refreshes it.
          p.captureTimestamps = [...p.captureTimestamps, now].filter((t) => now - t <= SURGE_WINDOW_MS);
          const needed = roleModifiers(p.role).surgeStreakNeeded;
          if (p.captureTimestamps.length >= needed) {
            p.surgeUntil = now + SURGE_DURATION_MS;
            p.captureTimestamps = [];
          }
        }
      }

      // Shield: 30 continuous ticks alone-and-maxed banks a charge.
      if (before >= 100 && wasOwner) {
        for (const p of occPlayers) {
          p.shieldHoldTicks += 1;
          if (p.shieldHoldTicks >= SHIELD_HOLD_SECONDS && p.shieldCharges < SHIELD_MAX_CHARGES) {
            p.shieldCharges += 1;
            p.shieldHoldTicks = 0;
          }
        }
      }
    } else {
      if (zone.skipNextDecay) {
        zone.skipNextDecay = false;
        continue;
      }
      if (!shielded) {
        zone.meter = Math.max(0, zone.meter - CONTEST_DECAY);
        if (zone.meter === 0) zone.owner = team;
      }
    }
  }

  io.emit('state', serializeState());
  io.emit('leaderboard', leaderboard());
}
