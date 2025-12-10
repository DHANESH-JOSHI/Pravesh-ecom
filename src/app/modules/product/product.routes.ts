import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductFilters,
  getProductBySlug,
  getRelatedProducts,
} from './product.controller';
import { auth, optionalAuth } from '@/middlewares';
import { authenticatedActionLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), createProduct);

router.get('/', optionalAuth(), getAllProducts);

router.get('/filters', getProductFilters);

router.get('/slug/:slug', optionalAuth(), getProductBySlug);

router.get('/:id/related', optionalAuth(), getRelatedProducts);

router.get('/:id', optionalAuth(), getProductById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), updateProduct);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteProduct);

export const productRouter = router;
