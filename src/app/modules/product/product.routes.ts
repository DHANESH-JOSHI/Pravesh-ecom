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
import { auth, optionalAuth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), createProduct);

router.get('/', apiLimiter, optionalAuth(), getAllProducts);

router.get('/filters', apiLimiter, getProductFilters);

router.get('/slug/:slug', apiLimiter, optionalAuth(), getProductBySlug);

router.get('/:id/related', apiLimiter, optionalAuth(), getRelatedProducts);

router.get('/:id', apiLimiter, optionalAuth(), getProductById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), updateProduct);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteProduct);

export const productRouter = router;
