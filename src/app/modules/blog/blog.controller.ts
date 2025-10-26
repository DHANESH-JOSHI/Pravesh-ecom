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

export const createBlog = asyncHandler(async (req, res) => {
  const blogData = createBlogValidation.parse(req.body);
  if (!req.file) {
    throw new ApiError(status.BAD_REQUEST, 'Featured image is required');
  }
  blogData.featuredImage = req.file?.path;
  const blog = await Blog.create(blogData);
  await redis.deleteByPattern('blogs*');
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Blog post created successfully', blog));
});

export const getPublishedBlogs = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('blogs:published', req.query);
  const cachedBlogs = await redis.get(cacheKey);

  if (cachedBlogs) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved published posts`, cachedBlogs));
  }

  const posts = await Blog.find({ isPublished: true, isDeleted: false }).sort({ createdAt: -1 });
  await redis.set(cacheKey, posts, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved ${posts.length} published posts`, posts));
});

export const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `blog:${slug}`;
  const cachedBlog = await redis.get(cacheKey);

  if (cachedBlog) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', cachedBlog));
  }

  const post = await Blog.findOne({ slug, isPublished: true, isDeleted: false });

  if (!post) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found');
  }

  await redis.set(cacheKey, post, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', post));
});

export const getAllBlogs = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('blogs', req.query);
  const cachedBlogs = await redis.get(cacheKey);

  if (cachedBlogs) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved all blogs`, cachedBlogs));
  }

  const posts = await Blog.find({ isDeleted: false }).sort({ createdAt: -1 });
  await redis.set(cacheKey, posts, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved all ${posts.length} blogs`, posts));
});

export const updateBlog = asyncHandler(async (req, res) => {
  const { id: blogId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid blog ID');
  }
  const postData = updateBlogValidation.parse(req.body);

  const existingBlog = await Blog.findOne({ _id: blogId, isDeleted: false });

  if (!existingBlog) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found or has been deleted');
  }

  if (req.file) {
    postData.featuredImage = req.file.path;
    if (existingBlog.featuredImage) {
      const publicId = existingBlog.featuredImage.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-blogs/${publicId}`);
      }
    }
  }

  const updatedBlog = await Blog.findByIdAndUpdate(
    existingBlog._id,
    postData,
    { new: true }
  );

  await redis.deleteByPattern('blogs*');
  await redis.deleteByPattern(`blog:${existingBlog.slug}`);

  res.status(status.OK).json(new ApiResponse(status.OK, `Blog updated successfully`, updatedBlog));
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const { id:blogId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid blog ID');
  }

  const existingBlog = await Blog.findOne({ _id: blogId, isDeleted: false });

  if (!existingBlog) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found');
  }

  const deletedBlog = await Blog.findByIdAndUpdate(
    existingBlog._id,
    { isDeleted: true, isPublished: false },
    { new: true }
  );

  await redis.deleteByPattern('blogs*');
  await redis.deleteByPattern(`blog:${existingBlog.slug}`);

  res.status(status.OK).json(new ApiResponse(status.OK, `Blog deleted successfully`, deletedBlog));
});