import express from 'express';
import {
    getMyCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartSummary,
    checkoutCart,
    getAllCarts
} from './cart.controller';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.get('/', auth('admin'), authenticatedActionLimiter, getAllCarts)

router.use(auth('user'));

router.use(authenticatedActionLimiter);

router.get('/summary', getCartSummary);

router.get('/me', getMyCart);

router.post('/add', addToCart);

router.patch('/item/:productId', updateCartItem);

router.delete('/item/:productId', removeFromCart);

router.delete('/clear', clearCart);

router.post('/checkout', checkoutCart);

export const cartRouter = router;
