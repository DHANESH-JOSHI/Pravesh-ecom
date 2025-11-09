import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getNewArrivalProducts,
  // getDiscountProducts,
  getProductsByCategory,
  searchProducts,
  getProductFilters,
  getProductBySlug,
  getBestSellingProducts,
  getTrendingProducts,
} from './product.controller';
import { auth } from '@/middlewares';
import { authenticatedActionLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), createProduct);

router.get('/', getAllProducts);

router.get('/search', searchProducts);

router.get('/featured', getFeaturedProducts);

router.get('/new-arrivals', getNewArrivalProducts);

// router.get('/discount', getDiscountProducts);

router.get('/filters', getProductFilters);

router.get('/best-selling', getBestSellingProducts);

router.get('/trending', getTrendingProducts);

router.get('/slug/:slug', getProductBySlug);

router.get('/category/:categoryId', getProductsByCategory);

router.get('/:id', getProductById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), updateProduct);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteProduct);

export const productRouter = router;
