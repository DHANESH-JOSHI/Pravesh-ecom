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
const ApiError = getApiErrorClass("PRODUCT");
const ApiResponse = getApiResponseClass("PRODUCT");

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const createProduct = asyncHandler(async (req, res) => {
  const productData: any = createProductValidation.parse(req.body);
  const existingSku = await Product.findOne({ sku: productData.sku, isDeleted: false });
  if (existingSku) {
    throw new ApiError(status.BAD_REQUEST, 'Product with this SKU already exists');
  }

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

  if (!productData.slug && productData.name) {
    const base = slugify(productData.name);
    let candidate = base;
    let i = 1;
    while (await Product.findOne({ slug: candidate })) {
      candidate = `${base}-${i++}`;
    }
    productData.slug = candidate;
  }

  if (req.files && typeof req.files === 'object') {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
      productData.thumbnail = files['thumbnail'][0].path;
    }
    if (Array.isArray(files['images'])) {
      productData.images = files['images'].map((file) => file.path);
    }
  }

  const product = await Product.create({
    ...productData,
    category: productData.categoryId,
    brand: productData.brandId,
  });

  await redis.deleteByPattern('products:all*');
  await redis.deleteByPattern('products:discount*');
  await redis.deleteByPattern('products:featured*');
  await redis.deleteByPattern('products:new-arrival*');
  await redis.deleteByPattern(`products:category:${product.category}*`);
  await redis.deleteByPattern('products:search*');
  await redis.delete(`category:${product.category}:populate=true`);
  await redis.delete(`brand:${product.brand}:populate=true`);
  await redis.delete('product_filters');
  await redis.delete('dashboard:stats')
  res.status(status.CREATED).json(
    new ApiResponse(status.CREATED, 'Product created successfully', product)
  );
  return;
});

export const getDiscountProducts = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('products:discount', req.query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Discount products retrieved successfully', cachedProducts)
    );
  }

  const { page = 1, limit = 10 } = req.query;
  const products = await Product.find({
    isDiscount: true,
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ discountValue: -1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  await redis.set(cacheKey, products, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Discount products retrieved successfully', products)
  );
  return;
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const { populate = 'false' } = req.query;
  const cacheKey = generateCacheKey(`product:${slug}`, req.query);
  const cachedProduct = await redis.get(cacheKey);

  if (cachedProduct) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product retrieved successfully', cachedProduct)
    );
  }

  if (!slug || slug.trim() === '') {
    throw new ApiError(status.BAD_REQUEST, 'Slug is required');
  }

  let product;
  if (populate === 'true') {
    product = await Product.findOne({ slug, isDeleted: false })
      .populate('category', 'brand')
  } else {
    product = await Product.findOne({ slug, isDeleted: false });
  }

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  await redis.set(cacheKey, product, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product retrieved successfully', product)
  );
  return;
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const query = productsQueryValidation.parse(req.query) as IProductQuery;
  const cacheKey = generateCacheKey('products:all', query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Products retrieved successfully', cachedProducts)
    );
  }

  const {
    page = 1,
    limit = 10,
    sort = 'createdAt',
    order = 'desc',
    categoryId,
    brandId,
    minPrice,
    maxPrice,
    stockStatus,
    isFeatured,
    isNewArrival,
    isDiscount,
    rating,
    search,
    isDeleted,
  } = query;

  const filter: any = {
  };
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted;
  } else {
    filter.isDeleted = false;
  }
  if (stockStatus) {
    filter.stockStatus = stockStatus;
  }
  if (categoryId) filter.category = categoryId;
  if (brandId) filter.brand = brandId;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (isNewArrival !== undefined) filter.isNewArrival = isNewArrival;
  if (isDiscount !== undefined) filter.isDiscount = isDiscount;
  if (minPrice || maxPrice) {
    filter.finalPrice = {};
    if (minPrice) {
      filter.finalPrice.$gte = Number(minPrice);
    }
    if (maxPrice) {
      filter.finalPrice.$lte = Number(maxPrice);
    }
  }

  if (rating) {
    filter.rating = { $gte: Number(rating) };
  }
  if (search) {
    filter.$text = { $search: search as string };
  }

  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj: any = {};
  sortObj[sort as string] = sortOrder;

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category brand')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    products,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Products retrieved successfully', result)
  );
  return;
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { populate = 'false' } = req.query;
  const cacheKey = generateCacheKey(`product:${id}`, req.query);
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
    product = await Product.findById(id).populate('category', '_id title').populate('brand', '_id name').populate({
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

  await redis.set(cacheKey, product, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product retrieved successfully', product)
  );
  return;
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData: any = createProductValidation.partial().parse(req.body);
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

  if (updateData.sku && updateData.sku !== existingProduct.sku) {
    const existingSku = await Product.findOne({
      sku: updateData.sku,
      isDeleted: false,
      _id: { $ne: id }
    });
    if (existingSku) {
      throw new ApiError(status.BAD_REQUEST, 'Product with this SKU already exists');
    }
  }

  if (!updateData.slug && updateData.name && updateData.name !== existingProduct.name) {
    const base = slugify(updateData.name);
    let candidate = base;
    let i = 1;
    while (await Product.findOne({ slug: candidate, _id: { $ne: id } })) {
      candidate = `${base}-${i++}`;
    }
    updateData.slug = candidate;
  } else if (updateData.slug) {
    const base = slugify(updateData.slug);
    let candidate = base;
    let i = 1;
    while (await Product.findOne({ slug: candidate, _id: { $ne: id } })) {
      candidate = `${base}-${i++}`;
    }
    updateData.slug = candidate;
  }

  if (req.files && typeof req.files === 'object') {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
      updateData.thumbnail = files['thumbnail'][0].path;
      if (existingProduct.thumbnail) {
        const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
        }
      }
    }

    if (Array.isArray(files['images']) && files['images'].length > 0) {
      updateData.images = files['images'].map((file) => file.path);
      if (existingProduct.images && existingProduct.images.length > 0) {
        const deletionPromises = existingProduct.images.map(imageUrl => {
          const publicId = imageUrl.split('/').pop()?.split('.')[0];
          if (publicId) {
            return cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
          }
          return Promise.resolve();
        });
        await Promise.all(deletionPromises);
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
  ).populate('category', 'brand');

  await redis.deleteByPattern('products:all*');
  await redis.deleteByPattern(`product:${id}*`);
  await redis.deleteByPattern(`products:search*`);
  await redis.deleteByPattern(`products:featured*`);
  await redis.deleteByPattern(`products:new-arrival*`);
  await redis.deleteByPattern(`products:discount*`);
  await redis.deleteByPattern(`products:category:${existingProduct.category}*`);
  await redis.delete(`category:${existingProduct.category}:populate=true`);
  await redis.delete(`brand:${existingProduct.brand}:populate=true`);
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

  await redis.deleteByPattern('products:all*');
  await redis.deleteByPattern(`product:${id}*`);
  await redis.deleteByPattern(`products:search*`);
  await redis.deleteByPattern(`products:featured*`);
  await redis.deleteByPattern(`products:new-arrival*`);
  await redis.deleteByPattern(`products:discount*`);
  await redis.deleteByPattern(`products:category:${product.category}*`);
  await redis.delete(`category:${product.category}:populate=true`);
  await redis.delete(`brand:${product.brand}:populate=true`);
  await redis.delete('product_filters');
  await redis.delete('dashboard:stats')

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product deleted successfully', result)
  );
});

export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = generateCacheKey('products:featured', req.query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Featured products retrieved successfully', cachedProducts)
    );
  }

  const filter = {
    isFeatured: true,
    status: 'active',
    isDeleted: false,
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'brand')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    products,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Featured products retrieved successfully', result)
  );
  return;
});

export const getNewArrivalProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = generateCacheKey('products:new-arrival', req.query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'New arrival products retrieved successfully', cachedProducts)
    );
  }

  const filter = {
    isNewArrival: true,
    status: 'active',
    isDeleted: false,
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'brand')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    products,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'New arrival products retrieved successfully', result)
  );
  return;
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const cacheKey = generateCacheKey(`products:category:${categoryId}`, req.query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Products retrieved successfully', cachedProducts)
    );
  }

  const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

  const filter = {
    category: categoryId,
    status: 'active',
    isDeleted: false,
  };

  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj: any = {};
  sortObj[sort as string] = sortOrder;

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'brand')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    products,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Products retrieved successfully', result)
  );
  return;
});

export const searchProducts = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('products:search', req.query);
  const cachedProducts = await redis.get(cacheKey);

  if (cachedProducts) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Products found successfully', cachedProducts)
    );
  }
  const { q, page = 1, limit = 10 } = req.query;

  const filter: any = {
    isDeleted: false,
  };
  if (q) {
    filter.$text = { $search: q as string };
  }
  const skip = (Number(page) - 1) * Number(limit);
  let products, total;
  if (q) {
    [products, total] = await Promise.all([
      Product.find(filter, { score: { $meta: 'textScore' } })
        .populate('category', 'brand')
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);
  } else {
    [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'brand')
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);
  }
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    products,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Products found successfully', result)
  );
  return;
});

export const getProductFilters = asyncHandler(async (req, res) => {
  const cacheKey = 'product_filters';
  const cachedFilters = await redis.get(cacheKey);

  if (cachedFilters) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Product filters retrieved successfully', cachedFilters)
    );
  }

  const brandIds = await Product.distinct('brand', { status: 'active', isDeleted: false });
  const categoryIds = await Product.distinct('category', { status: 'active', isDeleted: false });

  const [brands, categories, colors, sizes, priceRange] = await Promise.all([
    Brand.find({ _id: { $in: brandIds.filter(Boolean) }, isDeleted: false }).select('name _id'),
    Category.find({ _id: { $in: categoryIds.filter(Boolean) }, isDeleted: false }).select('title _id'),
    Product.distinct('specifications.color', { status: 'active', isDeleted: false }),
    Product.distinct('specifications.size', { status: 'active', isDeleted: false }),
    Product.aggregate([
      { $match: { status: 'active', isDeleted: false } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$finalPrice' },
          maxPrice: { $max: '$finalPrice' },
        },
      },
    ]),
  ]);

  const filters = {
    brands,
    categories,
    colors: colors.flat().filter(Boolean),
    sizes: sizes.flat().filter(Boolean),
    priceRange: { minPrice: priceRange?.[0]?.minPrice || 0, maxPrice: priceRange?.[0]?.maxPrice || 0 },
  };

  await redis.set(cacheKey, filters, 3600);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Product filters retrieved successfully', filters)
  );
  return;
});

export const getBestSellingProducts = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;

  const cacheKey = generateCacheKey('products:best-selling', req.query);
  const cachedResult = await redis.get(cacheKey);

  if (cachedResult) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Best selling products retrieved successfully', cachedResult)
    );
  }

  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    isDeleted: false,
    totalSold: { $gt: 0 }
  };

  const [bestSellers, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .sort({ totalSold: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('-__v'),
    Product.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limitNumber);
  const result = {
    products: bestSellers,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };
  await redis.set(cacheKey, result, 600);
  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Best selling products retrieved successfully', result)
  );
  return;
});

export const getTrendingProducts = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;

  const cacheKey = generateCacheKey('products:trending', req.query);
  const cachedResult = await redis.get(cacheKey);

  if (cachedResult) {
    return res.status(status.OK).json(
      new ApiResponse(status.OK, 'Trending products retrieved successfully', cachedResult)
    );
  }

  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    isDeleted: false,
    salesCount: { $gt: 0 }
  };

  const [trending, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .sort({ salesCount: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('-__v'),
    Product.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limitNumber);
  const result = {
    products: trending,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };
  await redis.set(cacheKey, result, 600);
  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Trending products retrieved successfully', result)
  );
  return;
});
