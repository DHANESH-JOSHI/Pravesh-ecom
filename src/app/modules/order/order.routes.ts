import express from 'express';
import { auth } from '@/middlewares';
import { upload } from '@/config/cloudinary';
import {
  checkoutFromCart,
  createCustomOrder,
  adminUpdateCustomOrder,
  confirmCustomOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
} from './order.controller';

const router = express.Router();

router.post('/checkout', auth('user'), checkoutFromCart);
router.post('/custom', auth('user'), upload.single('image'), createCustomOrder);
router.post('/custom/confirm/:orderId', auth('user'), confirmCustomOrder);
router.get('/my-orders', auth('user'), getMyOrders);

router.get('/', auth('admin'), getAllOrders);
router.patch('/custom/:orderId', auth('admin'), adminUpdateCustomOrder);
router.get('/:orderId', getOrderById);

export const orderRouter = router;