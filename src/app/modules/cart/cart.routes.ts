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
import { auth } from '../../middlewares/authMiddleware';

const router = express.Router();

router.get('/', auth('admin'), getAllCarts)

router.use(auth('user'));

router.get('/summary', getCartSummary);

router.get('/me', getMyCart);

router.post('/checkout', checkoutCart);

router.post('/add', addToCart);

router.put('/item/:productId', updateCartItem);

router.delete('/item/:productId', removeFromCart);

router.delete('/clear', clearCart);

export const cartRouter = router;
