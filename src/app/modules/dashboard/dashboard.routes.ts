import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { getDashboardStats } from './dashboard.controller';

const router = express.Router();

router.use(auth('admin'));

router.get('/stats', authenticatedActionLimiter, getDashboardStats);

export default router;