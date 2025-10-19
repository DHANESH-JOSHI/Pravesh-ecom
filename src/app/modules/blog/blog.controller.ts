import { asyncHandler, generateCacheKey } from '@/utils';
import { redis } from '@/config/redis';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import status from 'http-status';
import { Blog } from './blog.model';
import { createBlogValidation, updateBlogValidation } from './blog.validation';
import mongoose from 'mongoose';
import { cloudinary } from '@/config/cloudinary';

const ApiError = getApiErrorClass('BLOG');
const ApiResponse = getApiResponseClass('BLOG');

export const createBlogPost = asyncHandler(async (req, res) => {
  const blogData = createBlogValidation.parse(req.body);
  if (!req.file) {
    throw new ApiError(status.BAD_REQUEST, 'Featured image is required');
  }
  blogData.featuredImage = req.file?.path;
  const blog = await Blog.create(blogData);
  await redis.deleteByPattern('blogs*');
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Blog post created successfully', blog));
});

export const getPublishedPosts = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('blogs:published', req.query);
  const cachedPosts = await redis.get(cacheKey);

  if (cachedPosts) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved published posts`, cachedPosts));
  }

  const posts = await Blog.find({ isPublished: true, isDeleted: false }).sort({ createdAt: -1 });
  await redis.set(cacheKey, posts, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved ${posts.length} published posts`, posts));
});

export const getPostBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `blog:${slug}`;
  const cachedPost = await redis.get(cacheKey);

  if (cachedPost) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Blog post retrieved successfully', cachedPost));
  }

  const post = await Blog.findOne({ slug, isPublished: true, isDeleted: false });

  if (!post) {
    throw new ApiError(status.NOT_FOUND, 'Blog post not found');
  }

  await redis.set(cacheKey, post, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Blog post retrieved successfully', post));
});

export const getAllPosts = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('blogs', req.query);
  const cachedPosts = await redis.get(cacheKey);

  if (cachedPosts) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved all posts`, cachedPosts));
  }

  const posts = await Blog.find({ isDeleted: false }).sort({ createdAt: -1 });
  await redis.set(cacheKey, posts, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved all ${posts.length} posts`, posts));
});

export const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid post ID');
  }
  const postData = updateBlogValidation.parse(req.body);

  const existingPost = await Blog.findOne({ _id: postId, isDeleted: false });

  if (!existingPost) {
    throw new ApiError(status.NOT_FOUND, 'Blog post not found or has been deleted');
  }

  if (req.file) {
    postData.featuredImage = req.file.path;
    if (existingPost.featuredImage) {
      const publicId = existingPost.featuredImage.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-blogs/${publicId}`);
      }
    }
  }

  const updatedPost = await Blog.findByIdAndUpdate(
    existingPost._id,
    postData,
    { new: true }
  );

  await redis.deleteByPattern('blogs*');
  await redis.deleteByPattern(`blog:${existingPost.slug}`);

  res.status(status.OK).json(new ApiResponse(status.OK, `Post updated successfully`, updatedPost));
});

export const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid post ID');
  }

  const existingPost = await Blog.findOne({ _id: postId, isDeleted: false });

  if (!existingPost) {
    throw new ApiError(status.NOT_FOUND, 'Blog post not found');
  }

  const deletedPost = await Blog.findByIdAndUpdate(
    existingPost._id,
    { isDeleted: true, isPublished: false },
    { new: true }
  );

  await redis.deleteByPattern('blogs*');
  await redis.deleteByPattern(`blog:${existingPost.slug}`);

  res.status(status.OK).json(new ApiResponse(status.OK, `Post deleted successfully`, deletedPost));
});