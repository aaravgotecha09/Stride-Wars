// Campus Siege: groups the zone grid into sectors, tracks a recurring
// siege window, and resets the board when a siege cycle ends.

export const SECTOR_SIZE = 3; // 3x3 zones per sector (12/3 -> 4x4 = 16 sectors)
export const SECTOR_SECURE_RATIO = 0.55; // share of a sector's total meter needed to "secure" it

// Real deployments should use 5 days (7200 minutes); default is overridable
// via env so the siege cycle is actually observable in a demo/testing.
const SIEGE_DURATION_MS = Number(process.env.SIEGE_DURATION_MINUTES || 7200) * 60 * 1000;

let siegeStartedAt = Date.now();

export function sectorLabel(sx, sy) {
  return `${String.fromCharCode(65 + sx)}${sy + 1}`; // A1 .. D4
}

export function computeSectors(zones, gridSize) {
  const sectorsPerSide = gridSize / SECTOR_SIZE;
  const sectors = [];

  for (let sy = 0; sy < sectorsPerSide; sy++) {
    for (let sx = 0; sx < sectorsPerSide; sx++) {
      const totals = { red: 0, blue: 0, gold: 0 };
      let maxPossible = 0;

      for (let dy = 0; dy < SECTOR_SIZE; dy++) {
        for (let dx = 0; dx < SECTOR_SIZE; dx++) {
          const x = sx * SECTOR_SIZE + dx;
          const y = sy * SECTOR_SIZE + dy;
          const zone = zones.get(`${x},${y}`);
          maxPossible += 100;
          if (zone?.owner) totals[zone.owner] += zone.meter;
        }
      }

      const [topTeam, topValue] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      sectors.push({
        id: sectorLabel(sx, sy),
        sx,
        sy,
        totals,
        controllingTeam: topValue > 0 ? topTeam : null,
        secured: topValue >= maxPossible * SECTOR_SECURE_RATIO,
      });
    }
  }

  return sectors;
}

export function getSiegeStatus() {
  const now = Date.now();
  const elapsed = now - siegeStartedAt;
  return {
    startedAt: siegeStartedAt,
    durationMs: SIEGE_DURATION_MS,
    remainingMs: Math.max(0, SIEGE_DURATION_MS - elapsed),
  };
}

// Called once per tick. If the current siege window has elapsed, wipes the
// board back to neutral and starts a fresh cycle. Returns true on reset.
export function maybeResetSiege(zones) {
  const now = Date.now();
  if (now - siegeStartedAt < SIEGE_DURATION_MS) return false;

  for (const zone of zones.values()) {
    zone.owner = null;
    zone.meter = 0;
    zone.shieldUntil = null;
    zone.skipNextDecay = false;
  }
  siegeStartedAt = now;
  return true;
}
