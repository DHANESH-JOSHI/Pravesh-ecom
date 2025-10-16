import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { Request } from 'express';
import config from '@/config';
import { logger } from './logger';

// Configure cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET
});

// Create storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req: Request, file: Express.Multer.File) => {
      let folderName = 'pravesh-uploads'; // default
      if (req.originalUrl.includes('/products')) {
        folderName = 'pravesh-products';
      } else if (req.originalUrl.includes('/categories')) {
        folderName = 'pravesh-categories';
      } else if (req.originalUrl.includes('/brands')) {
        folderName = 'pravesh-brands';
      } else if (req.originalUrl.includes('/orders')) {
        folderName = 'pravesh-orders';
      }
      logger.info(`[CLOUDINARY]: ${file.originalname} (${file.mimetype}) uploaded to folder: ${folderName}`);
      return folderName;
    },
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
    transformation: [{ width: 1200, height: 600, crop: 'limit' }] // Appropriate for banners
  } as any
});

// Initialize multer upload
const upload = multer({ storage });

export { cloudinary, upload };
