"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBlog = exports.updateBlog = exports.getAllBlogs = exports.getBlogBySlug = exports.getBlogById = exports.createBlog = void 0;
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const invalidateCache_1 = require("../../utils/invalidateCache");
const cacheTTL_1 = require("../../utils/cacheTTL");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const blog_model_1 = require("./blog.model");
const blog_validation_1 = require("./blog.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const cloudinary_1 = require("../../config/cloudinary");
const ApiError = (0, interface_1.getApiErrorClass)('BLOG');
const ApiResponse = (0, interface_1.getApiResponseClass)('BLOG');
exports.createBlog = (0, utils_1.asyncHandler)(async (req, res) => {
    const blogData = blog_validation_1.createBlogValidation.parse(req.body);
    if (req.file)
        blogData.featuredImage = req.file?.path;
    const blog = await blog_model_1.Blog.create(blogData);
    await (0, invalidateCache_1.invalidateBlogCaches)({});
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Blog post created successfully', blog));
    return;
});
exports.getBlogById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid blog ID');
    }
    const cacheKey = redisKeys_1.RedisKeys.BLOG_BY_ID(id);
    const cachedBlog = await redis_1.redis.get(cacheKey);
    if (cachedBlog) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Blog retrieved successfully', cachedBlog));
    }
    const post = await blog_model_1.Blog.findOne({ _id: id, isDeleted: false }).lean();
    if (!post) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Blog not found');
    }
    await redis_1.redis.set(cacheKey, post, cacheTTL_1.CacheTTL.LONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Blog retrieved successfully', post));
    return;
});
exports.getBlogBySlug = (0, utils_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    if (!slug || !slug.trim()) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid blog slug');
    }
    const cacheKey = redisKeys_1.RedisKeys.BLOG_BY_SLUG(slug);
    const cachedBlog = await redis_1.redis.get(cacheKey);
    if (cachedBlog) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Blog retrieved successfully', cachedBlog));
    }
    const post = await blog_model_1.Blog.findOne({ slug, isDeleted: false }).lean();
    if (!post) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Blog not found');
    }
    await redis_1.redis.set(cacheKey, post, cacheTTL_1.CacheTTL.LONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Blog retrieved successfully', post));
    return;
});
exports.getAllBlogs = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, isPublished, isDeleted } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.BLOGS_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Retrieved blogs", cached));
    const filter = {};
    if (isPublished !== undefined)
        filter.isPublished = isPublished === "true";
    if (isDeleted !== undefined)
        filter.isDeleted = isDeleted === "true";
    else
        filter.isDeleted = false;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
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
    }
    else {
        pipeline.push({ $match: filter });
    }
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    const blogs = await blog_model_1.Blog.aggregate(pipeline);
    const total = await blog_model_1.Blog.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        blogs,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Retrieved blogs", result));
});
exports.updateBlog = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: blogId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(blogId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid blog ID');
    }
    const postData = blog_validation_1.updateBlogValidation.parse(req.body);
    const existingBlog = await blog_model_1.Blog.findOne({ _id: blogId, isDeleted: false });
    if (!existingBlog) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Blog not found or has been deleted');
    }
    if (req.file) {
        postData.featuredImage = req.file.path;
        if (existingBlog.featuredImage) {
            const publicId = existingBlog.featuredImage.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-blogs/${publicId}`);
            }
        }
    }
    const oldSlug = existingBlog.slug;
    const updatedBlog = await blog_model_1.Blog.findByIdAndUpdate(existingBlog._id, postData, { new: true });
    if (!updatedBlog) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Blog not found');
    }
    await (0, invalidateCache_1.invalidateBlogCaches)({
        blogId: String(existingBlog._id),
        slug: oldSlug !== updatedBlog.slug ? oldSlug : undefined
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Blog updated successfully`, updatedBlog));
    return;
});
exports.deleteBlog = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: blogId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(blogId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid blog ID');
    }
    const existingBlog = await blog_model_1.Blog.findOne({ _id: blogId, isDeleted: false });
    if (!existingBlog) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Blog not found');
    }
    const deletedBlog = await blog_model_1.Blog.findByIdAndUpdate(existingBlog._id, { isDeleted: true, isPublished: false }, { new: true });
    await (0, invalidateCache_1.invalidateBlogCaches)({ blogId: String(existingBlog._id) });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Blog deleted successfully`, deletedBlog));
    return;
});
//# sourceMappingURL=blog.controller.js.map