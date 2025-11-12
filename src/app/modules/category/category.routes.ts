import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryBySlug,
  getCategoryTree,
  getLeafCategories,
} from './category.controller';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, createCategory);

router.get('/tree', getCategoryTree)

router.get('/leaf', getLeafCategories);

router.get('/', getAllCategories);

router.get('/slug/:slug', getCategoryBySlug);

router.get('/:id', getCategoryById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, updateCategory);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteCategory);

export const categoryRouter = router;
