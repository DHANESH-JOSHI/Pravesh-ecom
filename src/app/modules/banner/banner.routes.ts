import express from 'express';
import { createBanner, deleteBanner, getAllBanners, updateBanner } from './banner.controller';
import { authenticatedActionLimiter, auth } from '@/middlewares';
import { upload } from '@/config/cloudinary';

const router = express.Router();

router.get('/', getAllBanners);

router.use(auth('admin'))

router.post('/', authenticatedActionLimiter, upload.single('image'), createBanner);

router.patch('/:id', authenticatedActionLimiter, upload.single('image'), updateBanner);

router.delete('/:id', authenticatedActionLimiter, deleteBanner);

export const bannerRouter = router;