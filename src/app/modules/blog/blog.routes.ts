import express from 'express';
import { auth, authenticatedActionLimiter } from '@/middlewares';
import { createBlogPost, deletePost, getAllPosts, getPostBySlug, getPublishedPosts, updatePost } from './blog.controller';

const router = express.Router();

router.get('/', getPublishedPosts);

router.get('/:slug', getPostBySlug);

router.use(auth('admin'), authenticatedActionLimiter);

router.post('/', createBlogPost);

router.get('/all', getAllPosts);

router.patch('/:postId', updatePost);

router.delete('/:postId', deletePost);

export const blogRouter = router;