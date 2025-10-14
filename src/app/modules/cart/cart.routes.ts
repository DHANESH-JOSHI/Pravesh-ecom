import express from 'express';
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartSummary,
} from './cart.controller';
import { auth } from '../../middlewares/authMiddleware';

const router = express.Router();

router.use(auth('user'));

router.get('/', getCart);

router.post('/add', addToCart);

router.put('/item/:productId', updateCartItem);

router.delete('/item/:productId', removeFromCart);

router.delete('/clear', clearCart);

router.get('/summary', getCartSummary);

export const cartRouter = router;
