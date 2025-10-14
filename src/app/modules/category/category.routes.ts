import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById
} from './category.controller';
import { upload } from '@/config/cloudinary';
import { auth } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), upload.single('image'), createCategory);

router.get('/', getAllCategories);

router.get('/:id', getCategoryById);

router.put('/:id', auth('admin'), upload.single('image'), updateCategoryById);

router.delete('/:id', auth('admin'), deleteCategoryById);

export const categoryRouter = router;
