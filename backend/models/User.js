import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  passwordHash: { type: String, required: true },
  team: { type: String, enum: ['red', 'blue', 'gold', null], default: null },
  role: { type: String, enum: ['scout', 'defender', 'sprinter', null], default: null },
  xp: { type: Number, default: 0 },
  // Garrison: banked async currency, accrued from XP earned while out running,
  // spendable (via /campaign/garrison) to remotely reinforce owned zones.
  reserveSteps: { type: Number, default: 0 },
  // Standing Orders: a passive priority idle players can set for a sector.
  standingOrder: {
    sectorId: { type: String, default: null },
    priority: { type: String, enum: ['defend', 'advance', null], default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
