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
  const { page = 1, limit = 10, search, isPublished, isDeleted } = req.query;
  const cacheKey = generateCacheKey('blogs', req.query);
  const cachedBlogs = await redis.get(cacheKey);

  if (cachedBlogs) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved blogs`, cachedBlogs));
  }

  const filter: any = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } }
    ];
  }
  if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted === 'true';
  } else {
    filter.isDeleted = false;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [posts, total] = await Promise.all([
    Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Blog.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    blogs: posts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Retrieved blogs`, result));
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