import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
import {
  createCustomOrder,
  updateOrder,
  confirmOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from './order.controller';

const router = express.Router();

router.post('/', auth('user'), authenticatedActionLimiter, createOrder);

router.post('/custom', auth('user'), authenticatedActionLimiter, upload.single('image'), createCustomOrder);

router.post('/confirm/:id', auth('user'), authenticatedActionLimiter, confirmOrder);

router.get('/me', auth('user'), authenticatedActionLimiter, getMyOrders);

// Admin routes (admin or staff can access)
router.get('/', auth('admin', 'staff'), authenticatedActionLimiter, getAllOrders);

router.patch('/:id', auth('admin', 'staff'), authenticatedActionLimiter, updateOrder);

router.patch('/:id/status', auth('admin', 'staff'), authenticatedActionLimiter, updateOrderStatus);

router.patch('/:id/cancel', auth('user'), authenticatedActionLimiter, cancelOrder);

router.get('/:id', auth(), authenticatedActionLimiter, getOrderById);

export const orderRouter = router;