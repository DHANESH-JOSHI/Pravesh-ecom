import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { createBlog, deleteBlog, getAllBlogs, getBlogBySlug, getPublishedBlogs, updateBlog } from './blog.controller';

const router = express.Router();

router.get('/', getPublishedBlogs);

router.get('/:slug', getBlogBySlug);

router.use(auth('admin'), authenticatedActionLimiter);

router.post('/', createBlog);

router.get('/all', getAllBlogs);

router.patch('/:id', updateBlog);

router.delete('/:id', deleteBlog);

export const blogRouter = router;