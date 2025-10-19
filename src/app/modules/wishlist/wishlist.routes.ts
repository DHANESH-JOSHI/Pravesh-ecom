import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { addProductToWishlist, getWishlist, removeProductFromWishlist } from './wishlist.controller';

const router = express.Router();

router.use(auth(), authenticatedActionLimiter);

router.get('/', getWishlist);
router.post('/add', addProductToWishlist);
router.post('/remove', removeProductFromWishlist);

export const wishlistRouter = router;