import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) {
    console.warn(
      '[StrideWars] No MONGODB_URI set — signup/login and persisted XP will not work until it is configured.'
    );
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[StrideWars] MongoDB connected successfully');
  } catch (err) {
    console.error('[StrideWars] MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('connected', () => console.log('[StrideWars] MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('[StrideWars] MongoDB error:', err.message));
}
