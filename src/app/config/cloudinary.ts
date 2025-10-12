import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import { Request } from 'express';

dotenv.config();


// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req: Request, file: Express.Multer.File) => {
      if (req.originalUrl.includes('/products')) {
        return 'restaurant-products';
      } else if (req.originalUrl.includes('/categories')) {
        return 'restaurant-categories';
      } else if (req.originalUrl.includes('/banners')) {
        return 'restaurant-banners';
      } else if (req.originalUrl.includes('/blogs')) {
        return 'restaurant-blogs';
      }
      return 'restaurant-uploads';
    },
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif','gif'],
    transformation: [{ width: 1200, height: 600, crop: 'limit' }] // Appropriate for banners
  } as any
});

// Initialize multer upload
const upload = multer({ storage });

export { cloudinary, upload };
