import express from 'express';
import {
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrandById,
    deleteBrandById
} from './brand.controller';
import { upload } from '@/config/cloudinary';
import { auth } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), upload.single('image'), createBrand);

router.get('/', getAllBrands);

router.get('/:id', getBrandById);

router.put('/:id', auth('admin'), upload.single('image'), updateBrandById);

router.delete('/:id', auth('admin'), deleteBrandById);

export const brandRouter = router;