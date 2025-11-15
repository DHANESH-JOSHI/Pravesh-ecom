import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { createBlog, deleteBlog, getAllBlogs, getBlogById, updateBlog, getBlogBySlug } from './blog.controller';
import { upload } from '@/config/cloudinary';

const router = express.Router();

router.get('/slug/:slug', getBlogBySlug);

router.get('/:id', getBlogById);

router.get('/', getAllBlogs);

router.use(auth('admin'), authenticatedActionLimiter);

router.post('/', upload.single('featuredImage'), createBlog);

router.patch('/:id', upload.single('featuredImage'), updateBlog);

router.delete('/:id', deleteBlog);

export const blogRouter = router;