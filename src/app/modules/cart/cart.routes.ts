import express from 'express';
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartSummary,
    checkoutCart,
} from './cart.controller';
import { auth } from '../../middlewares/authMiddleware';

const router = express.Router();

router.use(auth('user'));

router.get('/summary', getCartSummary);

router.get('/', getCart);

router.post('/checkout', checkoutCart);

router.post('/add', addToCart);

router.put('/item/:productId', updateCartItem);

router.delete('/item/:productId', removeFromCart);

router.delete('/clear', clearCart);

export const cartRouter = router;
