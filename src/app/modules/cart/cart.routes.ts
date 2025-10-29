import express from 'express';
import {
  getMyCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
  checkoutCart,
  getAllCarts,
  getCartById,
} from './cart.controller';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.use(authenticatedActionLimiter);

router.get('/', auth('admin'), getAllCarts)

router.get('/me', auth('user'),getMyCart);

router.get('/summary', auth('user'),getCartSummary);

router.get('/:id', auth('admin'), getCartById)

router.post('/add', auth('user'),addToCart);

router.patch('/item/:productId', auth('user'),updateCartItem);

router.delete('/item/:productId', auth('user'),removeFromCart);

router.delete('/clear', auth('user'),clearCart);

router.post('/checkout', auth('user'),checkoutCart);

export const cartRouter = router;
