import express from 'express';
import { createBanner, deleteBanner, getActiveBanners, getAllBanners, updateBanner } from './banner.controller';
import { authenticatedActionLimiter, auth } from '@/middlewares';

const router = express.Router();

router.get('/', getActiveBanners);

router.use(auth('admin'))

router.get('/all', getAllBanners);

router.post('/', authenticatedActionLimiter, createBanner);

router.patch('/:bannerId', authenticatedActionLimiter, updateBanner);

router.delete('/:bannerId', authenticatedActionLimiter, deleteBanner);

export const bannerRouter = router;