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
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single('image'), createBrand);

router.get('/', getAllBrands);

router.get('/:id', getBrandById);

router.get('/slug/:slug', getBrandBySlug);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single('image'), updateBrand);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteBrand);

export const brandRouter = router;