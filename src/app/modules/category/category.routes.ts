import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById
} from './category.controller';
import { upload } from '@/config/cloudinary';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single('image'), createCategory);

router.get('/', getAllCategories);

router.get('/:id', getCategoryById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single('image'), updateCategoryById);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteCategoryById);

export const categoryRouter = router;
