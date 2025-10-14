import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getTrendingProducts,
  getNewArrivalProducts,
  getDiscountProducts,
  getProductsByCategory,
  searchProducts,
  getProductFilters,
  getProductBySlug,
} from './product.controller';
import { auth } from '@/middlewares';
import { upload } from '@/config/cloudinary';
const router = express.Router();

router.post('/', auth('admin'), upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 10 }]), createProduct);

router.get('/', getAllProducts);

router.get('/search', searchProducts);

router.get('/featured', getFeaturedProducts);

router.get('/trending', getTrendingProducts);

router.get('/new-arrivals', getNewArrivalProducts);

router.get('/discount', getDiscountProducts);

router.get('/filters', getProductFilters);

router.get('/slug/:slug', getProductBySlug);

router.get('/category/:categoryId', getProductsByCategory);

router.get('/:id', getProductById);

router.put('/:id', auth('admin'), upload.fields([ { name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 10 } ]), updateProduct);

router.delete('/:id', auth('admin'), deleteProduct);

export const productRouter = router;
