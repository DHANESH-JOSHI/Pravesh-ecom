import { asyncHandler } from '@/utils';
import { RedisKeys } from '@/utils/redisKeys';
import { RedisPatterns } from '@/utils/redisKeys';
import { CacheTTL } from '@/utils/cacheTTL';
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
  const blogData: any = createBlogValidation.parse(req.body);
  if (req.file) blogData.featuredImage = req.file?.path;
  const blog = await Blog.create(blogData);
  await redis.deleteByPattern(RedisPatterns.BLOGS_ALL());
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Blog post created successfully', blog));
  return;
});

export const getBlogById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid blog ID');
  }
  const cacheKey = RedisKeys.BLOG_BY_ID(id);
  const cachedBlog = await redis.get(cacheKey);

  if (cachedBlog) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', cachedBlog));
  }

  const post = await Blog.findOne({ _id: id }).lean();

  if (!post) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found');
  }

  await redis.set(cacheKey, post, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', post));
  return;
});

export const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!slug || !slug.trim()) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid blog slug');
  }
  const cacheKey = RedisKeys.BLOG_BY_SLUG(slug);
  const cachedBlog = await redis.get(cacheKey);

  if (cachedBlog) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', cachedBlog));
  }

  const post = await Blog.findOne({ slug }).lean();

  if (!post) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found');
  }

  await redis.set(cacheKey, post, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Blog retrieved successfully', post));
  return;
});

export const getAllBlogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, isPublished, isDeleted } = req.query;

  const cacheKey = RedisKeys.BLOGS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Retrieved blogs", cached));

  const filter: any = {};
  if (isPublished !== undefined) filter.isPublished = isPublished === "true";
  if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";
  else filter.isDeleted = false;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const searchCriteria = {
      $or: [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } },
        { slug: { $regex: searchRegex } }
      ]
    };

    const combinedMatch = {
      $and: [
        searchCriteria,
        filter
      ]
    };

    pipeline.push({ $match: combinedMatch });

  } else {
    pipeline.push({ $match: filter });
  }
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  const blogs = await Blog.aggregate(pipeline);
  const total = await Blog.countDocuments(filter);

  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    blogs,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Retrieved blogs", result));
});

export const updateBlog = asyncHandler(async (req, res) => {
  const { id: blogId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid blog ID');
  }
  const postData: any = updateBlogValidation.parse(req.body);

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

  const oldSlug = existingBlog.slug;
  
  const updatedBlog = await Blog.findByIdAndUpdate(
    existingBlog._id,
    postData,
    { new: true }
  );

  if (!updatedBlog) {
    throw new ApiError(status.NOT_FOUND, 'Blog not found');
  }

  await redis.deleteByPattern(RedisPatterns.BLOG_ANY(String(existingBlog._id)));
  await redis.deleteByPattern(RedisPatterns.BLOG_BY_SLUG_ANY(oldSlug));
  await redis.deleteByPattern(RedisPatterns.BLOGS_ALL());
  
  if (oldSlug !== updatedBlog.slug) {
    await redis.deleteByPattern(RedisPatterns.BLOG_BY_SLUG_ANY(updatedBlog.slug));
  }

  res.status(status.OK).json(new ApiResponse(status.OK, `Blog updated successfully`, updatedBlog));
  return;
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const { id: blogId } = req.params;
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

  await redis.deleteByPattern(RedisPatterns.BLOG_ANY(String(existingBlog._id)));
  await redis.deleteByPattern(RedisPatterns.BLOG_BY_SLUG_ANY(existingBlog.slug));
  await redis.deleteByPattern(RedisPatterns.BLOGS_ALL());

  res.status(status.OK).json(new ApiResponse(status.OK, `Blog deleted successfully`, deletedBlog));
  return;
});