import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
  getBrandBySlug
} from './brand.controller';
import { upload } from '@/config/cloudinary';
import { auth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single('image'), createBrand);

router.get('/slug/:slug', apiLimiter, getBrandBySlug);

router.get('/', apiLimiter, getAllBrands);

router.get('/:id', apiLimiter, getBrandById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single('image'), updateBrand);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteBrand);

export const brandRouter = router;