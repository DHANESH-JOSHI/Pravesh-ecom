import express from 'express';
import { auth } from '@/middlewares';
import { createReview, deleteReview, getAllReviews, getMyReviews, getProductReviews, updateReview } from './review.controller';
const router = express.Router();

router.get('/', auth('admin'), getAllReviews);

router.get('/me', auth('user'), getMyReviews);

router.get('/:productId', getProductReviews);

router.post('/', auth('user'), createReview);

router.patch('/:id', auth('user'), updateReview);

router.delete('/:id', auth('user'), deleteReview);

export const reviewRouter = router;
