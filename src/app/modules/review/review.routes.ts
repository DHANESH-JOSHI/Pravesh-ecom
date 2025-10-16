import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { createReview, deleteReview, getAllReviews, getMyReviews, getProductReviews, updateReview } from './review.controller';
const router = express.Router();

router.get('/', auth('admin'), authenticatedActionLimiter, getAllReviews);

router.get('/me', auth('user'), authenticatedActionLimiter, getMyReviews);

router.get('/:productId', getProductReviews);

router.post('/', auth('user'), authenticatedActionLimiter, createReview);

router.patch('/:id', auth('user'), authenticatedActionLimiter, updateReview);

router.delete('/:id', auth('user'), authenticatedActionLimiter, deleteReview);

export const reviewRouter = router;
