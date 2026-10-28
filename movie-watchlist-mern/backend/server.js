import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import movieRoutes from './src/routes/movieRoutes.js';
import { errorHandler, notFound } from './src/middleware/errors.js';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || ['http://localhost:5173'] }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Movie Watchlist API is running', data: { status: 'ok' } }));
app.use('/api/movies', movieRoutes);
app.use('/api/stats', (await import('./src/routes/statsRoutes.js')).default);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
if (!uri || uri.includes('YOUR_CLUSTER') || uri.includes('EXAM_USER')) {
  console.error('Configure backend/.env with your MongoDB Atlas connection string before starting.');
  process.exit(1);
}
mongoose.connect(uri, { dbName: process.env.DB_NAME || 'movie_watchlist' })
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    app.listen(port, () => console.log(`API listening at http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
