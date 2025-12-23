import { redis } from '@/config/redis';
import { Product } from './product.model';
import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { cloudinary } from '@/config/cloudinary';
import { RedisPatterns } from '@/utils/redisKeys';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { createProductValidation, productsQueryValidation } from './product.validation';
import { Category } from '../category/category.model';
import { Brand } from '../brand/brand.model';
import { IProductQuery } from './product.interface';
import status from 'http-status';
import mongoose from 'mongoose';
import { getLeafCategoryIds } from '../brand/brand.controller';
import { CacheTTL } from '@/utils/cacheTTL';
import { UserRole } from '../user/user.interface';
const ApiError = getApiErrorClass("PRODUCT");
const ApiResponse = getApiResponseClass("PRODUCT");

export const createProduct = asyncHandler(async (req, res) => {
  const productData = createProductValidation.parse(req.body);
  if (productData.categoryId) {
    const existingCategory = await Category.findOne({ _id: productData.categoryId, isDeleted: false });
    if (!existingCategory) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid category ID');
    }
  }
  if (productData.brandId) {
    const existingBrand = await Brand.findOne({ _id: productData.brandId, isDeleted: false });
    if (!existingBrand) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid brand ID');
    }
  }

  if (req.file) {
    productData.thumbnail = req.file.path;
  }

  // if (req.files && typeof req.files === 'object') {
  //   const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  //   if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
  //     productData.thumbnail = files['thumbnail'][0].path;
  //   }
  //   if (Array.isArray(files['images'])) {
  //     productData.images = files['images'].map((file) => file.path);
  //   }
  // }

  const product = await Product.create({
    ...productData,
    category: productData.categoryId,
    brand: productData.brandId,
  });

  // Invalidate this product's cache (new product created)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(product._id)));
  // Invalidate product cache by slug (new product created)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(product.slug));
  // Invalidate related products cache (new product might be related to others)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_RELATED_ANY(String(product._id)));
  // Invalidate all product lists (new product added to lists)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate product filters (new product might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate dashboard stats (product count changed)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());
  // Invalidate all user carts (carts display product name, thumbnail, etc.)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY("*"));
  // Invalidate all cart lists (carts display product info)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  
  // Invalidate category caches (category productCount changed)
  if (product.category) {
    // Invalidate specific category cache (productCount changed)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(product.category)));
    // Invalidate all category lists (productCount displayed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  
  // Invalidate brand caches (brand productCount changed)
  if (product.brand) {
    // Invalidate specific brand cache (productCount changed)
    await redis.deleteByPattern(RedisPatterns.BRAND_ANY(String(product.brand)));
    // Invalidate all brand lists (productCount displayed in lists)
    await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  }
  res.status(status.CREATED).json(
    new ApiResponse(status.CREATED, 'Product created successfully', product)
  );
  return;
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const { populate = 'false' } = req.query;
  const isAdmin = req.user?.role === UserRole.ADMIN;
  const cacheKey = RedisKeys.PRODUCT_BY_SLUG(slug, { ...req.query, isAdmin });
  const cachedProduct = await redis.get(cacheKey);

  if (cachedProduct) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product retrieved', cachedProduct)
    );
  }

  if (!slug || slug.trim() === '') {
    throw new ApiError(status.BAD_REQUEST, 'Slug is required');
  }

  let product;
  if (populate === 'true') {
    product = await Product.findOne({ slug })
      .populate([
        { path: 'category', match: { isDeleted: false } },
        { path: 'brand', match: { isDeleted: false } }
      ])
  } else {
    product = await Product.findOne({ slug });
  }

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  // Ensure plain object before caching
  product = (product as any).toObject ? (product as any).toObject() : product;

  await redis.set(cacheKey, product, CacheTTL.LONG);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product retrieved', product)
  );
  return;
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const query = productsQueryValidation.parse(req.query) as IProductQuery;
  const isAdmin = req.user?.role === UserRole.ADMIN;
  const cacheKey = RedisKeys.PRODUCTS_LIST({ ...query, isAdmin });
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Products retrieved successfully", cachedProducts));
  }

  const {
    page = 1,
    limit = 10,
    sort = "createdAt",
    order = "desc",
    categoryId,
    brandId,
    isFeatured,
    isNewArrival,
    search,
    rating,
    isDeleted,
  } = query;

  const filter: any = { isDeleted: isDeleted ?? false };

  if (categoryId) {
    const allIds = await getLeafCategoryIds(categoryId as any);
    filter.category = { $in: allIds.map((id: any) => new mongoose.Types.ObjectId(id)) };
  }

  if (brandId) filter.brand = new mongoose.Types.ObjectId(brandId);


  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (isNewArrival !== undefined) filter.isNewArrival = isNewArrival;
  if (rating) filter.rating = { $gte: Number(rating) };

  const sortMap: Record<string, string> = {
    trending: "salesCount",
    bestSelling: "totalSold",
    newArrivals: "createdAt",
    featured: "isFeatured",
    rating: "rating",
    createdAt: "createdAt",
  };
  const sortField = sortMap[sort] || "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    const searchRegex = new RegExp(search, 'i');

    const searchCriteria = {
      $or: [
        { name: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } },
        { slug: { $regex: searchRegex } }
      ]
    };

    pipeline.push({ $match: searchCriteria });
  }

  pipeline.push({ $match: filter });

  pipeline.push({ $sort: { [sortField]: sortOrder } });

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "category",
      foreignField: "_id",
      pipeline: [
        { $match: { isDeleted: false } },
        {
          $project: {
            _id: 1,
            title: 1,
            slug: 1,
            path: 1,
          },
        },
      ],
      as: "category",
    },
  });
  pipeline.push({
    $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
  });

  pipeline.push({
    $lookup: {
      from: "brands",
      localField: "brand",
      foreignField: "_id",
      pipeline: [
        { $match: { isDeleted: false } },
        {
          $project: {
            _id: 1,
            name: 1,
            slug: 1,
          },
        },
      ],
      as: "brand",
    },
  });
  pipeline.push({
    $unwind: { path: "$brand", preserveNullAndEmptyArrays: true },
  });

  const [products, total] = await Promise.all([
    Product.aggregate(pipeline),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  const processedProducts = products;

  const result = {
    products: processedProducts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, CacheTTL.LONG);

  return res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Products retrieved successfully", result));
});


export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { populate = 'false' } = req.query;
  const isAdmin = req.user?.role === UserRole.ADMIN;
  const cacheKey = RedisKeys.PRODUCT_BY_ID(id, { ...req.query, isAdmin });
  const cachedProduct = await redis.get(cacheKey);

  if (cachedProduct) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product retrieved successfully', cachedProduct)
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }
  let product;
  if (populate == 'true') {
    product = await Product.findOne({ _id: id })
      .populate({ path: 'category', select: 'slug title path', match: { isDeleted: false } })
      .populate({ path: 'brand', select: 'slug name', match: { isDeleted: false } })
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          select: 'name img'
        }
      })
  } else {
    product = await Product.findOne({ _id: id });
  }
  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  // Ensure plain object before caching
  product = (product as any).toObject ? (product as any).toObject() : product;

  await redis.set(cacheKey, product, CacheTTL.LONG);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product retrieved successfully', product)
  );
  return;
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = createProductValidation.partial().parse(req.body);
  const existingProduct = await Product.findOne({ _id: id, isDeleted: false });
  if (!existingProduct) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  if (updateData.categoryId) {
    const existingCategory = await Category.findOne({ _id: updateData.categoryId, isDeleted: false });
    if (!existingCategory) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid category ID');
    }
  }
  if (updateData.brandId) {
    const existingBrand = await Brand.findOne({ _id: updateData.brandId, isDeleted: false });
    if (!existingBrand) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid brand ID');
    }
  }

  // if (req.files && typeof req.files === 'object') {
  //   const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  //   if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
  //     updateData.thumbnail = files['thumbnail'][0].path;
  //     if (existingProduct.thumbnail) {
  //       const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
  //       if (publicId) {
  //         await cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
  //       }
  //     }
  //   }

  //   if (Array.isArray(files['images']) && files['images'].length > 0) {
  //     updateData.images = files['images'].map((file) => file.path);
  //     if (existingProduct.images && existingProduct.images.length > 0) {
  //       const deletionPromises = existingProduct.images.map(imageUrl => {
  //         const publicId = imageUrl.split('/').pop()?.split('.')[0];
  //         if (publicId) {
  //           return cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
  //         }
  //         return Promise.resolve();
  //       });
  //       await Promise.all(deletionPromises);
  //     }
  //   }
  // }

  if (req.file) {
    updateData.thumbnail = req.file.path;
    if (existingProduct.thumbnail) {
      const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
      }
    }
  }

  const result = await Product.findByIdAndUpdate(
    id,
    {
      ...updateData,
      category: updateData.categoryId,
      brand: updateData.brandId,
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'category', match: { isDeleted: false } },
    { path: 'brand', match: { isDeleted: false } }
  ]);

  if (!result) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  const oldSlug = existingProduct.slug;
  const newSlug = result.slug;
  const oldCategoryId = String(existingProduct.category);
  const newCategoryId = String(result.category);
  const oldBrandId = existingProduct.brand ? String(existingProduct.brand) : undefined;
  const newBrandId = result.brand ? String(result.brand) : undefined;

  // Invalidate this product's cache by ID (product data changed)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(id)));
  // Invalidate product cache by old slug (slug might have changed)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(oldSlug));
  // Invalidate related products cache (product data changed, might affect related products)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_RELATED_ANY(String(id)));
  
  // If slug changed, invalidate new slug cache
  if (newSlug !== oldSlug) {
    await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(newSlug));
  }
  
  // Invalidate all product lists (product data changed in lists)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate product filters (product data might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate dashboard stats (product data might affect stats)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());
  // Invalidate all user carts (carts display product name, thumbnail, etc.)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY("*"));
  // Invalidate all cart lists (carts display product info)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  
  // Invalidate category caches if category changed (affects category productCount)
  if (oldCategoryId && oldCategoryId !== newCategoryId) {
    // Invalidate old category cache (productCount decreased)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(oldCategoryId));
  }
  
  if (newCategoryId && newCategoryId !== oldCategoryId) {
    // Invalidate new category cache (productCount increased)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(newCategoryId));
  }
  if (oldCategoryId !== newCategoryId) {
    // Invalidate all category lists (productCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  
  // Invalidate brand caches if brand changed (affects brand productCount)
  if (oldBrandId && oldBrandId !== newBrandId) {
    // Invalidate old brand cache (productCount decreased)
    await redis.deleteByPattern(RedisPatterns.BRAND_ANY(oldBrandId));
  }
  
  if (newBrandId && newBrandId !== oldBrandId) {
    // Invalidate new brand cache (productCount increased)
    await redis.deleteByPattern(RedisPatterns.BRAND_ANY(newBrandId));
  }
  if (oldBrandId !== newBrandId) {
    // Invalidate all brand lists (productCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  }

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product updated successfully', result)
  );
  return;
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  const deletedProduct = await Product.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!deletedProduct) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  // Invalidate this product's cache by ID (product deleted)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(id)));
  // Invalidate product cache by slug (product deleted)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(product.slug));
  // Invalidate related products cache (product deleted, might affect related products)
  await redis.deleteByPattern(RedisPatterns.PRODUCT_RELATED_ANY(String(id)));
  // Invalidate all product lists (product removed from lists)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate product filters (product removed, might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate dashboard stats (product count decreased)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());
  // Invalidate all user carts (carts display product info, product is now deleted)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY("*"));
  // Invalidate all cart lists (carts display product info)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  
  // Invalidate category caches (category productCount decreased)
  if (product.category) {
    // Invalidate specific category cache (productCount decreased)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(product.category)));
    // Invalidate all category lists (productCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  
  // Invalidate brand caches (brand productCount decreased)
  if (product.brand) {
    // Invalidate specific brand cache (productCount decreased)
    await redis.deleteByPattern(RedisPatterns.BRAND_ANY(String(product.brand)));
    // Invalidate all brand lists (productCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  }

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product deleted successfully', deletedProduct)
  );
});


export const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;
  const limitNumber = Math.min(Number(limit) || 10, 20);
  const isAdmin = req.user?.role === UserRole.ADMIN;

  const cacheKey = RedisKeys.PRODUCT_RELATED(String(id), { limit: limitNumber, isAdmin });
  const cachedRelated = await redis.get(cacheKey);

  if (cachedRelated) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Related products retrieved successfully', cachedRelated)
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  // Find the current product
  const currentProduct = await Product.findOne({ _id: id, isDeleted: false }).select('category brand tags');
  if (!currentProduct) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  // Priority 1: Same category
  // Priority 2: Same brand (if exists)
  // Priority 3: Similar tags (if exists)

  // Build match conditions with priority scoring
  const matchConditions: any[] = [];

  // Category match (highest priority)
  if (currentProduct.category) {
    matchConditions.push({
      category: currentProduct.category,
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      isDeleted: false,
    });
  }

  // Brand match (if brand exists)
  if (currentProduct.brand) {
    matchConditions.push({
      brand: currentProduct.brand,
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      isDeleted: false,
    });
  }

  // Tags match (if tags exist)
  if (currentProduct.tags && currentProduct.tags.length > 0) {
    matchConditions.push({
      tags: { $in: currentProduct.tags },
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      isDeleted: false,
    });
  }

  // If no match conditions, return empty
  if (matchConditions.length === 0) {
    const result = { products: [], total: 0 };
    await redis.set(cacheKey, result, CacheTTL.LONG);
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Related products retrieved successfully', result)
    );
  }

  // Use aggregation to find related products with priority scoring
  const pipeline: any[] = [
    {
      $match: {
        $or: matchConditions,
        isDeleted: false
      }
    },
    // Add priority score
    {
      $addFields: {
        priority: {
          $sum: [
            { $cond: [{ $eq: ['$category', currentProduct.category] }, 3, 0] },
            { $cond: [{ $eq: ['$brand', currentProduct.brand] }, 2, 0] },
            {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $setIntersection: ['$tags', currentProduct.tags || []],
                      },
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          ],
        },
      },
    },
    // Sort by priority (descending), then by rating, then by totalSold
    {
      $sort: {
        priority: -1,
        rating: -1,
        totalSold: -1,
        createdAt: -1,
      },
    },
    // Limit results
    { $limit: limitNumber },
    // Lookup category
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        pipeline: [
          { $match: { isDeleted: false } },
          {
            $project: {
              _id: 1,
              title: 1,
              slug: 1,
              path: 1,
            },
          },
        ],
        as: "category",
      },
    },
    {
      $unwind: { path: '$category', preserveNullAndEmptyArrays: true },
    },
    // Lookup brand
    {
      $lookup: {
        from: "brands",
        localField: "brand",
        foreignField: "_id",
        pipeline: [
          { $match: { isDeleted: false } },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
            },
          },
        ],
        as: "brand",
      },
    },
    {
      $unwind: { path: '$brand', preserveNullAndEmptyArrays: true },
    },
  ];

  // Remove priority field from final output
  pipeline.push({
    $project: {
      priority: 0,
    },
  });

  const relatedProducts = await Product.aggregate(pipeline);

  const processedProducts = relatedProducts;

  const result = {
    products: processedProducts,
    total: processedProducts.length,
  };

  await redis.set(cacheKey, result, CacheTTL.LONG);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Related products retrieved successfully', result)
  );
  return;
});


export const getProductFilters = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.PRODUCT_FILTERS();
  const cachedFilters = await redis.get(cacheKey);

  if (cachedFilters) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product filters retrieved successfully', cachedFilters)
    );
  }

  const brandIds = await Product.distinct('brand', { isDeleted: false });
  const categoryIds = await Product.distinct('category', { isDeleted: false });

  const [brands, categories] = await Promise.all([
    Brand.find({ _id: { $in: brandIds.filter(Boolean) }, isDeleted: false }).select('name slug'),
    Category.find({ _id: { $in: categoryIds.filter(Boolean) }, isDeleted: false }).select('title slug'),
  ]);

  const filters = {
    brands,
    categories,
  };

  await redis.set(cacheKey, filters, CacheTTL.XLONG);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product filters retrieved successfully', filters)
  );
  return;
});
