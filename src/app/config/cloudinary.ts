import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { Request } from 'express';
import config from '@/config';
import { logger } from './logger';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req: Request, file: Express.Multer.File) => {
      let folderName = 'pravesh-uploads';
      if (req.originalUrl.includes('/products')) {
        folderName = 'pravesh-products';
      } else if (req.originalUrl.includes('/users')) {
        folderName = 'pravesh-users';
      } else if (req.originalUrl.includes('/categories')) {
        folderName = 'pravesh-categories';
      } else if (req.originalUrl.includes('/brands')) {
        folderName = 'pravesh-brands';
      } else if (req.originalUrl.includes('/orders')) {
        folderName = 'pravesh-orders';
      } else if (req.originalUrl.includes('/blogs')) {
        folderName = 'pravesh-blogs';
      } else if (req.originalUrl.includes('/banners')) {
        folderName = 'pravesh-banners';
      }
      logger.info(`[CLOUDINARY]: ${file.originalname} (${file.mimetype}) uploaded to folder: ${folderName}`);
      return folderName;
    },
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
    transformation: [{ width: 1200, height: 600, crop: 'limit' }]
  } as any
});

const upload = multer({ storage });

export { cloudinary, upload };
