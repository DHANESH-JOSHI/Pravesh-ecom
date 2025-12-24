import express from 'express';
import { auth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';
import { createReview, deleteReview, getAllReviews, getMyReviews, getProductReviews, getReviewById, updateReview } from './review.controller';
const router = express.Router();

router.get('/', auth('admin'), authenticatedActionLimiter, getAllReviews);

router.get('/me', auth('user'), authenticatedActionLimiter, getMyReviews);

router.get('/:id', auth('admin'), authenticatedActionLimiter, getReviewById)

router.get('/product/:productId', apiLimiter, getProductReviews);

router.post('/', auth('user'), authenticatedActionLimiter, createReview);

router.patch('/:id', auth('user'), authenticatedActionLimiter, updateReview);

router.delete('/:id', auth('user'), authenticatedActionLimiter, deleteReview);

export const reviewRouter = router;
