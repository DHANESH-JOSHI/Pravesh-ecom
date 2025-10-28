import express from 'express';
import { auth } from '@/middlewares';
import { getDashboardStats } from './dashboard.controller';

const router = express.Router();

router.use(auth('admin'));

router.get('/stats', getDashboardStats);

export default router;