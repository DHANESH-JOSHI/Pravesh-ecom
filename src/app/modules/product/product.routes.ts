import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  // getDiscountProducts,
  getProductFilters,
  getProductBySlug,
} from './product.controller';
import { auth } from '@/middlewares';
import { authenticatedActionLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), createProduct);

router.get('/', getAllProducts);

router.get('/filters', getProductFilters);

router.get('/slug/:slug', getProductBySlug);

router.get('/:id', getProductById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), updateProduct);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteProduct);

export const productRouter = router;
