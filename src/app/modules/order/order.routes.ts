import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
import {
  createCustomOrder,
  adminUpdateCustomOrder,
  confirmCustomOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  createOrder,
} from './order.controller';

const router = express.Router();

router.post('/', auth('user'), authenticatedActionLimiter, createOrder);

router.post('/custom', auth('user'), authenticatedActionLimiter, upload.single('image'), createCustomOrder);

router.post('/confirm/:orderId', auth('user'), authenticatedActionLimiter, confirmCustomOrder);

router.get('/me', auth('user'), authenticatedActionLimiter, getMyOrders);

router.get('/', auth('admin'), authenticatedActionLimiter, getAllOrders);

router.patch('/:orderId', auth('admin'), authenticatedActionLimiter, adminUpdateCustomOrder);

router.get('/:orderId', auth(), authenticatedActionLimiter, getOrderById);

export const orderRouter = router;