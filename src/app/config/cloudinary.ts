import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';
import config from '@/config';
import { logger } from './logger';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 60000,
});

const customStorage = {
  _handleFile: function(req: Request, file: Express.Multer.File, cb: (error?: any, info?: any) => void) {
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
    } else if (req.originalUrl.includes('/settings')) {
      folderName = 'pravesh-logo';
    }
    
    let transformation: any[] = [];
    switch (folderName) {
      case 'pravesh-products':
        transformation = [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto:good', format: 'auto' }];
        break;
      case 'pravesh-users':
        transformation = [{ width: 400, height: 400, crop: 'limit', quality: 'auto' }];
        break;
      case 'pravesh-categories':
      case 'pravesh-brands':
        transformation = [{ width: 800, height: 400, crop: 'fill', quality: 'auto:good', format: 'auto' }];
        break;
      case 'pravesh-banners':
        transformation = [{ width: 1920, height: 600, crop: 'fill', quality: 'auto:good', format: 'auto' }];
        break;
      case 'pravesh-blogs':
        transformation = [{ width: 1200, height: 630, crop: 'fill', quality: 'auto:good', format: 'auto' }];
        break;
      case 'pravesh-logo':
        transformation = [{ width: 500, height: 500, crop: 'limit', quality: 'auto:best', format: 'auto' }];
        break;
      case 'pravesh-orders':
        transformation = [{ width: 1200, height: 1600, crop: 'limit', quality: 'auto:good', format: 'auto' }];
        break;
      default:
        transformation = [{ width: 1200, height: 600, crop: 'limit', quality: 'auto:good', format: 'auto' }];
    }
    
    const uploadOptions: any = {
      folder: folderName,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
      use_filename: true,
      unique_filename: true,
      resource_type: 'auto',
    };
    
    if (transformation.length > 0) {
      uploadOptions.transformation = transformation;
    }
    
    logger.info(`[CLOUDINARY]: Uploading ${file.originalname} (${file.mimetype}) to folder: ${folderName}`);
    
    const chunks: Buffer[] = [];
    
    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const dataUri = `data:${file.mimetype};base64,${buffer.toString('base64')}`;
        
        const { upload_preset, ...signedUploadOptions } = uploadOptions;
        
        const result = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload(
            dataUri,
            signedUploadOptions,
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
        });
        
        if (!result) {
          return cb(new Error("Upload returned no result"));
        }
        
        logger.info(`[CLOUDINARY] Upload successful for ${file.originalname}, path: ${result.secure_url || result.url}`);
        
        const info = {
          path: result.secure_url || result.url,
          filename: result.public_id,
          size: result.bytes,
          mimetype: file.mimetype,
        };
        
        cb(null, info);
      } catch (error: any) {
        logger.error(`[CLOUDINARY] Upload failed for ${file.originalname}:`, error);
        cb(error);
      }
    });
    
    file.stream.on('error', (error) => {
      cb(error);
    });
  },
  _removeFile: function(req: Request, file: Express.Multer.File, cb: (error?: any) => void) {
    cb();
  }
};

const upload = multer({ 
  storage: customStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

export { cloudinary, upload };
