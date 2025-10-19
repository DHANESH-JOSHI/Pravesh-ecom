import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrandById,
  deleteBrandById
} from './brand.controller';
import { upload } from '@/config/cloudinary';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single('image'), createBrand);

router.get('/', getAllBrands);

router.get('/:id', getBrandById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single('image'), updateBrandById);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteBrandById);

export const brandRouter = router;