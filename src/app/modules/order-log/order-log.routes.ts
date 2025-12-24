import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import {
  getOrderLogsByOrderId,
  getRecentOrderLogs,
  getLogsByStaff,
  getUserLogAnalyticsController,
  getAllAnalyticsController
} from './order-log.controller';

const router = express.Router();

router.get('/order/:orderId', auth('admin'), authenticatedActionLimiter, getOrderLogsByOrderId);

router.get('/recent', auth('admin'), authenticatedActionLimiter, getRecentOrderLogs);
router.get('/staff/:staffId', auth('admin'), authenticatedActionLimiter, getLogsByStaff);
router.get('/staff/:staffId/analytics', auth('admin'), authenticatedActionLimiter, getUserLogAnalyticsController);

// Unified analytics endpoint
router.get('/analytics/all', auth('admin'), authenticatedActionLimiter, getAllAnalyticsController);

export const orderLogRouter = router;

