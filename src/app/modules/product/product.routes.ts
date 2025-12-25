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
  bulkImportProducts,
} from './product.controller';
import { auth, optionalAuth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';
import { upload } from '@/config/cloudinary';
import multer from 'multer';

const memoryStorage = multer.memoryStorage();
const csvUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), createProduct);

router.post('/bulk-import', auth('admin'), authenticatedActionLimiter, csvUpload.single("csv"), bulkImportProducts);

router.get('/', apiLimiter, optionalAuth(), getAllProducts);

router.get('/filters', apiLimiter, getProductFilters);

router.get('/slug/:slug', apiLimiter, optionalAuth(), getProductBySlug);

router.get('/:id/related', apiLimiter, optionalAuth(), getRelatedProducts);

router.get('/:id', apiLimiter, optionalAuth(), getProductById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, upload.single("thumbnail"), updateProduct);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteProduct);

export const productRouter = router;
