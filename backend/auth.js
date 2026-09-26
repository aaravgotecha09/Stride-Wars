import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Protects any REST route: verifies the bearer JWT and attaches { id, username }
// to req.auth. Used by every /campaign/* route.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function publicUser(user) {
  return {
    username: user.username,
    xp: user.xp,
    team: user.team,
    role: user.role,
    reserveSteps: user.reserveSteps,
  };
}

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Callsign and password are required.' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Callsign must be 3–20 characters.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'That callsign is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[StrideWars] signup failed:', err.message);
    res.status(500).json({ error: 'Signup failed. Is MONGODB_URI configured?' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Callsign and password are required.' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid callsign or password.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid callsign or password.' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[StrideWars] login failed:', err.message);
    res.status(500).json({ error: 'Login failed. Is MONGODB_URI configured?' });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

