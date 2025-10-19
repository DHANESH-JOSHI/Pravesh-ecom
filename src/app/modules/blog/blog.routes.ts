import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { createBlogPost, deletePost, getAllPosts, getPostBySlug, getPublishedPosts, updatePost } from './blog.controller';

const router = express.Router();

// Public routes
router.get('/', getPublishedPosts);
router.get('/:slug', getPostBySlug);

// Admin routes
router.use(auth('admin'), authenticatedActionLimiter);

router.post('/', createBlogPost);
router.get('/all', getAllPosts); // Changed from '/admin/all' to just '/all' under the admin-protected path
router.patch('/:postId', updatePost);
router.delete('/:postId', deletePost);

export const blogRouter = router;