import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
  getChildCategories
} from './category.controller';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, createCategory);

router.get('/', getAllCategories);

router.get('/children/:parentCategoryId', getChildCategories);

router.get('/:id', getCategoryById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, updateCategoryById);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteCategoryById);

export const categoryRouter = router;
