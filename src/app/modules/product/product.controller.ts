import { redis } from '@/config/redis';
import { Product } from './product.model';
import { asyncHandler, generateCacheKey } from '@/utils';
import { cloudinary } from '@/config/cloudinary';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { createProductValidation, productsQueryValidation } from './product.validation';
import { Category } from '../category/category.model';
import { Brand } from '../brand/brand.model';
import { IProductQuery } from './product.interface';
import status from 'http-status';
import mongoose from 'mongoose';
import { getLeafCategoryIds } from '../brand/brand.controller';
const ApiError = getApiErrorClass("PRODUCT");
const ApiResponse = getApiResponseClass("PRODUCT");

export const createProduct = asyncHandler(async (req, res) => {
  const productData = createProductValidation.parse(req.body);
  if (productData.categoryId) {
    const existingCategory = await Category.findById(productData.categoryId);
    if (!existingCategory) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid category ID');
    }
  }
  if (productData.brandId) {
    const existingBrand = await Brand.findById(productData.brandId);
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

  await redis.deleteByPattern('products*');
  await redis.delete(`category:${product.category}?populate=true`);
  await redis.delete(`brand:${product.brand}?populate=true`);
  await redis.delete('product_filters');
  await redis.delete('dashboard:stats')
  res.status(status.CREATED).json(
    new ApiResponse(status.CREATED, 'Product created successfully', product)
  );
  return;
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const { populate = 'false' } = req.query;
  const includePrice = (req.query as any)?.includePrice !== 'false';
  const cacheKey = generateCacheKey(`product:${slug}`, { ...(req.query as any), includePrice });
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
    product = await Product.findOne({ slug, isDeleted: false })
      .populate('category brand')
  } else {
    product = await Product.findOne({ slug, isDeleted: false });
  }

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  if (!includePrice) {
    product = (product as any).toObject ? (product as any).toObject() : product;
    delete (product as any).originalPrice;
  }

  await redis.set(cacheKey, product, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product retrieved', product)
  );
  return;
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const query = productsQueryValidation.parse(req.query) as IProductQuery;
  const includePrice = (req.query as any)?.includePrice !== "false";
  const cacheKey = generateCacheKey("products", { ...query, includePrice });
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
    minPrice,
    maxPrice,
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

  if (minPrice || maxPrice) {
    filter.originalPrice = {};
    if (minPrice) filter.originalPrice.$gte = Number(minPrice);
    if (maxPrice) filter.originalPrice.$lte = Number(maxPrice);
  }

  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (isNewArrival !== undefined) filter.isNewArrival = isNewArrival;
  if (rating) filter.rating = { $gte: Number(rating) };

  const sortMap: Record<string, string> = {
    trending: "salesCount",
    bestSelling: "totalSold",
    newArrivals: "createdAt",
    featured: "isFeatured",
    rating: "rating",
    price: "originalPrice",
    createdAt: "createdAt",
  };
  const sortField = sortMap[sort] || "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    pipeline.push({
      $search: {
        index: "product_search",
        compound: {
          should: [
            {
              autocomplete: {
                query: search,
                path: "name",
                fuzzy: { maxEdits: 1 }
              }
            },
            {
              autocomplete: {
                query: search,
                path: "tags",
                fuzzy: { maxEdits: 1 }
              }
            },
            {
              autocomplete: {
                query: search,
                path: "slug",
                fuzzy: { maxEdits: 1 }
              }
            }
          ]
        }
      },
    });
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

  const result = {
    products: includePrice
      ? products
      : products.map(({ originalPrice, ...rest }) => rest),

    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  return res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Products retrieved successfully", result));
});


export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { populate = 'false' } = req.query;
  const includePrice = (req.query as any)?.includePrice !== 'false';
  const cacheKey = generateCacheKey(`product:${id}`, { ...(req.query as any), includePrice });
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
    product = await Product.findById(id).populate('category', 'slug title path').populate('brand', 'slug name').populate({
      path: 'reviews',
      populate: {
        path: 'user',
        select: 'name img'
      }
    })
  } else {
    product = await Product.findById(id);
  }
  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  if (!includePrice) {
    product = (product as any).toObject ? (product as any).toObject() : product;
    delete (product as any).originalPrice;
  }

  await redis.set(cacheKey, product, 3600);

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
    const existingCategory = await Category.findById(updateData.categoryId);
    if (!existingCategory) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid category ID');
    }
  }
  if (updateData.brandId) {
    const existingBrand = await Brand.findById(updateData.brandId);
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
  ).populate('category brand');

  await redis.deleteByPattern('products*');
  await redis.deleteByPattern(`product:${id}*`);
  await redis.delete(`category:${existingProduct.category}?populate=true`);
  await redis.delete(`brand:${existingProduct.brand}?populate=true`);
  await redis.delete('product_filters');
  await redis.delete('dashboard:stats')

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product updated successfully', result)
  );
  return;
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  const result = await Product.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!result) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  await redis.deleteByPattern('products*');
  await redis.deleteByPattern(`product:${id}*`);
  await redis.delete(`category:${product.category}?populate=true`);
  await redis.delete(`brand:${product.brand}?populate=true`);
  await redis.delete('product_filters');
  await redis.delete('dashboard:stats')

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product deleted successfully', result)
  );
});

// export const getFeaturedProducts = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10 } = req.query;
//   const cacheKey = generateCacheKey('products:featured', req.query);
//   const cachedProducts = await redis.get(cacheKey);

//   if (cachedProducts) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Featured products retrieved successfully', cachedProducts)
//     );
//   }

//   const filter = {
//     isFeatured: true,
//     isDeleted: false,
//   };

//   const skip = (Number(page) - 1) * Number(limit);

//   const [products, total] = await Promise.all([
//     Product.find(filter)
//       .populate('category', 'brand')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit)),
//     Product.countDocuments(filter),
//   ]);

//   const totalPages = Math.ceil(total / Number(limit));
//   const result = {
//     products,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };

//   await redis.set(cacheKey, result, 3600);

//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Featured products retrieved successfully', result)
//   );
//   return;
// });

// export const getNewArrivalProducts = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10 } = req.query;
//   const cacheKey = generateCacheKey('products:new-arrival', req.query);
//   const cachedProducts = await redis.get(cacheKey);

//   if (cachedProducts) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'New arrival products retrieved successfully', cachedProducts)
//     );
//   }

//   const filter = {
//     isNewArrival: true,
//     isDeleted: false,
//   };

//   const skip = (Number(page) - 1) * Number(limit);

//   const [products, total] = await Promise.all([
//     Product.find(filter)
//       .populate('category', 'brand')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit))
//       .lean(),
//     Product.countDocuments(filter),
//   ]);

//   const totalPages = Math.ceil(total / Number(limit));
//   const result = {
//     products,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };

//   await redis.set(cacheKey, result, 3600);

//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'New arrival products retrieved successfully', result)
//   );
//   return;
// });

// export const getProductsByCategory = asyncHandler(async (req, res) => {
//   const { categoryId } = req.params;
//   const cacheKey = generateCacheKey(`products:category:${categoryId}`, req.query);
//   const cachedProducts = await redis.get(cacheKey);

//   if (cachedProducts) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Products retrieved successfully', cachedProducts)
//     );
//   }

//   const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

//   const filter = {
//     category: categoryId,
//     isDeleted: false,
//   };

//   const sortOrder = order === 'asc' ? 1 : -1;
//   const sortObj: any = {};
//   sortObj[sort as string] = sortOrder;

//   const skip = (Number(page) - 1) * Number(limit);

//   const [products, total] = await Promise.all([
//     Product.find(filter)
//       .populate('category', 'brand')
//       .sort(sortObj)
//       .skip(skip)
//       .limit(Number(limit)),
//     Product.countDocuments(filter),
//   ]);

//   const totalPages = Math.ceil(total / Number(limit));
//   const result = {
//     products,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };

//   await redis.set(cacheKey, result, 3600);

//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Products retrieved successfully', result)
//   );
//   return;
// });

// export const searchProducts = asyncHandler(async (req, res) => {
//   const cacheKey = generateCacheKey('products:search', req.query);
//   const cachedProducts = await redis.get(cacheKey);

//   if (cachedProducts) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Products found successfully', cachedProducts)
//     );
//   }
//   const { q, page = 1, limit = 10 } = req.query;

//   const filter: any = {
//     isDeleted: false,
//   };
//   if (q) {
//     filter.$text = { $search: q as string };
//   }
//   const skip = (Number(page) - 1) * Number(limit);
//   let products, total;
//   if (q) {
//     [products, total] = await Promise.all([
//       Product.find(filter, { score: { $meta: 'textScore' } })
//         .populate('category brand')
//         .sort({ score: { $meta: 'textScore' } })
//         .skip(skip)
//         .limit(Number(limit)),
//       Product.countDocuments(filter),
//     ]);
//   } else {
//     [products, total] = await Promise.all([
//       Product.find(filter)
//         .populate('category brand')
//         .skip(skip)
//         .limit(Number(limit)),
//       Product.countDocuments(filter),
//     ]);
//   }
//   const totalPages = Math.ceil(total / Number(limit));
//   const result = {
//     products,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };

//   await redis.set(cacheKey, result, 3600);

//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Products found successfully', result)
//   );
//   return;
// });

export const getProductFilters = asyncHandler(async (req, res) => {
  const cacheKey = 'product_filters';
  const cachedFilters = await redis.get(cacheKey);

  if (cachedFilters) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product filters retrieved successfully', cachedFilters)
    );
  }

  const brandIds = await Product.distinct('brand', { isDeleted: false });
  const categoryIds = await Product.distinct('category', { isDeleted: false });

  const [brands, categories, priceRange] = await Promise.all([
    Brand.find({ _id: { $in: brandIds.filter(Boolean) }, isDeleted: false }).select('name slug'),
    Category.find({ _id: { $in: categoryIds.filter(Boolean) }, isDeleted: false }).select('title slug'),
    // Product.distinct('specifications.color', { isDeleted: false }),
    // Product.distinct('specifications.size', { isDeleted: false }),
    Product.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$originalPrice' },
          maxPrice: { $max: '$originalPrice' },
        },
      },
    ]),
  ]);

  const filters = {
    brands,
    categories,
    // colors: colors.flat().filter(Boolean),
    // sizes: sizes.flat().filter(Boolean),
    priceRange: { minPrice: priceRange?.[0]?.minPrice || 0, maxPrice: priceRange?.[0]?.maxPrice || 0 },
  };

  await redis.set(cacheKey, filters, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product filters retrieved successfully', filters)
  );
  return;
});

// export const getBestSellingProducts = asyncHandler(async (req, res) => {
//   const { limit = 10, page = 1 } = req.query;

//   const cacheKey = generateCacheKey('products:best-selling', req.query);
//   const cachedResult = await redis.get(cacheKey);

//   if (cachedResult) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Best selling products retrieved successfully', cachedResult)
//     );
//   }

//   const pageNumber = parseInt(page as string);
//   const limitNumber = parseInt(limit as string);
//   const skip = (pageNumber - 1) * limitNumber;

//   const filter = {
//     isDeleted: false,
//     totalSold: { $gt: 0 }
//   };

//   const [bestSellers, total] = await Promise.all([
//     Product.find(filter)
//       .populate('category', 'name slug')
//       .populate('brand', 'name slug')
//       .sort({ totalSold: -1 })
//       .skip(skip)
//       .limit(limitNumber)
//       .select('-__v'),
//     Product.countDocuments(filter)
//   ]);

//   const totalPages = Math.ceil(total / limitNumber);
//   const result = {
//     products: bestSellers,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };
//   await redis.set(cacheKey, result, 600);
//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Best selling products retrieved successfully', result)
//   );
//   return;
// });

// export const getTrendingProducts = asyncHandler(async (req, res) => {
//   const { limit = 10, page = 1 } = req.query;

//   const cacheKey = generateCacheKey('products:trending', req.query);
//   const cachedResult = await redis.get(cacheKey);

//   if (cachedResult) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Trending products retrieved successfully', cachedResult)
//     );
//   }

//   const pageNumber = parseInt(page as string);
//   const limitNumber = parseInt(limit as string);
//   const skip = (pageNumber - 1) * limitNumber;

//   const filter = {
//     isDeleted: false,
//     salesCount: { $gt: 0 }
//   };

//   const [trending, total] = await Promise.all([
//     Product.find(filter)
//       .populate('category', 'name slug')
//       .populate('brand', 'name slug')
//       .sort({ salesCount: -1, updatedAt: -1 })
//       .skip(skip)
//       .limit(limitNumber)
//       .select('-__v'),
//     Product.countDocuments(filter)
//   ]);

//   const totalPages = Math.ceil(total / limitNumber);
//   const result = {
//     products: trending,
//     page: Number(page),
//     limit: Number(limit),
//     total,
//     totalPages,
//   };
//   await redis.set(cacheKey, result, 600);
//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Trending products retrieved successfully', result)
//   );
//   return;
// });
