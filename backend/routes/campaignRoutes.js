import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { User } from '../models/User.js';
import { GRID_SIZE, ROLES, zones, players, serializeState } from '../gameState.js';
import { computeSectors, getSiegeStatus } from '../campaign.js';

function findLivePlayerByUserId(userId) {
  for (const p of players.values()) {
    if (p.userId === userId) return p;
  }
  return null;
}

export function campaignRouter(io) {
  const router = Router();

  // ---------------- Campus Siege ----------------
  router.get('/sectors', requireAuth, (_req, res) => {
    res.json({ sectors: computeSectors(zones, GRID_SIZE), siege: getSiegeStatus() });
  });

  router.post('/role', requireAuth, async (req, res) => {
    const { role } = req.body || {};
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ROLES.join(', ')}.` });
    }
    const user = await User.findByIdAndUpdate(req.auth.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const live = findLivePlayerByUserId(user._id.toString());
    if (live) {
      live.role = role;
      io.emit('state', serializeState());
    }
    res.json({ role: user.role });
  });

  // ---------------- Garrison (async defense via banked reserve steps) ----------------
  router.post('/garrison', requireAuth, async (req, res) => {
    const { x, y, amount } = req.body || {};
    const zone = zones.get(`${x},${y}`);
    if (!zone) return res.status(400).json({ error: 'Unknown zone.' });

    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (!user.team) {
      return res.status(400).json({ error: 'Deploy at least once to be assigned a squad first.' });
    }
    if (zone.owner !== user.team) {
      return res.status(400).json({ error: 'You can only reinforce zones your own squad already holds.' });
    }
    if (user.reserveSteps <= 0) {
      return res
        .status(400)
        .json({ error: 'No reserve steps banked yet — they build up from XP earned while out running.' });
    }

    const requested = Math.max(1, Math.min(Number(amount) || 10, 25));
    const spend = Math.min(requested, user.reserveSteps, 100 - zone.meter);
    if (spend <= 0) {
      return res.status(400).json({ error: 'That zone is already fully held.' });
    }

    zone.meter = Math.min(100, zone.meter + spend);
    user.reserveSteps -= spend;
    await user.save();

    io.emit('state', serializeState());
    res.json({ reserveSteps: user.reserveSteps, zone: { x: zone.x, y: zone.y, meter: zone.meter } });
  });

  // ---------------- Supply Lines (async XP gift to a teammate) ----------------
  router.post('/supply', requireAuth, async (req, res) => {
    const { toUsername, amount } = req.body || {};
    const sendAmount = Math.floor(Number(amount));
    if (!toUsername || !sendAmount || sendAmount <= 0) {
      return res.status(400).json({ error: 'Provide a recipient callsign and a positive amount.' });
    }

    const sender = await User.findById(req.auth.id);
    const recipient = await User.findOne({ username: toUsername });
    if (!recipient) return res.status(404).json({ error: 'No runner with that callsign.' });
    if (recipient._id.equals(sender._id)) {
      return res.status(400).json({ error: "You can't send XP to yourself." });
    }

    // If either party is currently deployed, their live in-memory XP is the
    // source of truth; otherwise fall back to their persisted document.
    const senderLive = findLivePlayerByUserId(sender._id.toString());
    const availableXp = senderLive ? senderLive.xp : sender.xp;
    if (sendAmount > availableXp) {
      return res.status(400).json({ error: 'Not enough XP to send that much.' });
    }

    if (senderLive) senderLive.xp -= sendAmount;
    else {
      sender.xp -= sendAmount;
      await sender.save();
    }

    const recipientLive = findLivePlayerByUserId(recipient._id.toString());
    if (recipientLive) recipientLive.xp += sendAmount;
    else {
      recipient.xp += sendAmount;
      await recipient.save();
    }

    if (senderLive || recipientLive) io.emit('state', serializeState());
    res.json({ ok: true, sent: sendAmount, to: recipient.username });
  });

  // ---------------- Scouting Reports (async intel digest) ----------------
  router.get('/scouting', requireAuth, async (req, res) => {
    const user = await User.findById(req.auth.id);
    if (!user?.team) {
      return res.status(400).json({ error: 'Deploy at least once to join a squad first.' });
    }

    const team = user.team;
    const sectors = computeSectors(zones, GRID_SIZE);
    const securedSectors = sectors.filter((s) => s.controllingTeam === team && s.secured).map((s) => s.id);
    const threats = sectors
      .filter((s) => s.controllingTeam && s.controllingTeam !== team && s.secured)
      .map((s) => s.id);
    const recommended = sectors
      .filter((s) => s.controllingTeam !== team)
      .sort((a, b) => (b.totals[team] || 0) - (a.totals[team] || 0))[0];

    res.json({
      yourTeam: team,
      securedSectors,
      threats,
      recommended: recommended ? recommended.id : null,
      siege: getSiegeStatus(),
    });
  });

  // ---------------- Standing Orders (passive priority for idle players) ----------------
  router.get('/orders', requireAuth, async (req, res) => {
    const user = await User.findById(req.auth.id);
    res.json({ standingOrder: user?.standingOrder || null });
  });

  router.post('/orders', requireAuth, async (req, res) => {
    const { sectorId, priority } = req.body || {};
    if (!['defend', 'advance'].includes(priority)) {
      return res.status(400).json({ error: "Priority must be 'defend' or 'advance'." });
    }
    const user = await User.findByIdAndUpdate(
      req.auth.id,
      { standingOrder: { sectorId: sectorId || null, priority } },
      { new: true }
    );
    res.json({ standingOrder: user.standingOrder });
  });

  return router;
}
