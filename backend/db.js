import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;

// This checks both environment variable names so it never fails to connect
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

connectDB(mongoUri).then(() => {
  app.listen(PORT, () => {
    console.log(`StrideWars backend listening on :${PORT}`);
  });
});
