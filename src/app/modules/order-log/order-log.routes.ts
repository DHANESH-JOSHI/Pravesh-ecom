import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import {
  getOrderLogById,
  getAllLogsController,
  getAllAnalyticsController
} from './order-log.controller';

const router = express.Router();

router.get('/', auth('admin'), authenticatedActionLimiter, getAllLogsController);

router.get('/analytics', auth('admin'), authenticatedActionLimiter, getAllAnalyticsController);

router.get('/:id', auth('admin'), authenticatedActionLimiter, getOrderLogById);

export const orderLogRouter = router;

