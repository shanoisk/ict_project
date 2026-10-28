import { Router } from 'express';
import { getStats } from '../controllers/statsController.js';
const router = Router();
const routerStats = Router();
routerStats.get('/', getStats);
export default routerStats;
