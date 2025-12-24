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
import { auth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, createCategory);

router.get('/tree', apiLimiter, getCategoryTree)

router.get('/leaf', apiLimiter, getLeafCategories);

router.get('/', apiLimiter, getAllCategories);

router.get('/slug/:slug', apiLimiter, getCategoryBySlug);

router.get('/:id', apiLimiter, getCategoryById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, updateCategory);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteCategory);

export const categoryRouter = router;
