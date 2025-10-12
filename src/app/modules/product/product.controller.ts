import { Product } from './product.model';
// import { IProduct, IProductFilter } from './product.interface';
import mongoose from 'mongoose';
import { asyncHandler } from '@/utils';
import { ApiError, ApiResponse } from '@/interface';

// Create a new product
const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const createProduct = asyncHandler(async (req, res, next) => {
  const productData = req.body;

  // Check if SKU already exists
  const existingSku = await Product.findOne({ sku: productData.sku, isDeleted: false });
  if (existingSku) {
    throw new ApiError(400, 'Product with this SKU already exists');
  }

  // Generate slug if not provided
  if (!productData.slug && productData.name) {
    let base = slugify(productData.name);
    let candidate = base;
    let i = 1;
    // Ensure uniqueness
    while (await Product.findOne({ slug: candidate })) {
      candidate = `${base}-${i++}`;
    }
    productData.slug = candidate;
  }

  const result = await Product.create(productData);
  const populatedResult = await Product.findById(result._id).populate('category', 'brand');

  res.status(201).json(
    new ApiResponse(201, 'Product created successfully', populatedResult)
  );
});

export const getDiscountProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isDiscount: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ discount: -1, createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'Discount products retrieved successfully', products)
  );
});

export const getWeeklyBestSellingProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isWeeklyBestSelling: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ reviewCount: -1, rating: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'Weekly best selling products retrieved successfully', products)
  );
});

export const getWeeklyDiscountProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isWeeklyDiscount: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ discount: -1, createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'Weekly discount products retrieved successfully', products)
  );
});

export const getProductBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params as { slug: string };

  const product = await Product.findOne({ slug, isDeleted: false })
    .populate('category', 'brand')
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  res.json(
    new ApiResponse(200, 'Product retrieved successfully', product)
  );
});

export const getAllProducts = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    sort = 'createdAt',
    order = 'desc',
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    status = 'active',
    isFeatured,
    isTrending,
    isNewArrival,
    isDiscount,
    isWeeklyBestSelling,
    isWeeklyDiscount,
    colors,
    sizes,
    rating,
    search,
  } = req.query;

  // Build filter object
  const filter: any = { isDeleted: false };

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (brand) filter.brand = new RegExp(brand as string, 'i');
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
  if (isTrending !== undefined) filter.isTrending = isTrending === 'true';
  if (isNewArrival !== undefined) filter.isNewArrival = isNewArrival === 'true';
  if (isDiscount !== undefined) filter.isDiscount = isDiscount === 'true';
  if (isWeeklyBestSelling !== undefined) filter.isWeeklyBestSelling = isWeeklyBestSelling === 'true';
  if (isWeeklyDiscount !== undefined) filter.isWeeklyDiscount = isWeeklyDiscount === 'true';
  if (inStock !== undefined) {
    filter['inventory.stock'] = inStock === 'true' ? { $gt: 0 } : 0;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    filter['pricing.basePrice'] = {};
    if (minPrice) filter['pricing.basePrice'].$gte = Number(minPrice);
    if (maxPrice) filter['pricing.basePrice'].$lte = Number(maxPrice);
  }

  // Colors filter
  if (colors) {
    const colorArray = (colors as string).split(',');
    filter.specifications.color = { $in: colorArray };
  }

  // Sizes filter
  if (sizes) {
    const sizeArray = (sizes as string).split(',');
    filter.specifications.size = { $in: sizeArray };
  }

  // Rating filter
  if (rating) {
    filter.rating = { $gte: Number(rating) };
  }
``
  // Search filter
  if (search) {
    filter.$text = { $search: search as string };
  }

  // Sorting
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj: any = {};
  sortObj[sort as string] = sortOrder;

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'brand')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json(
    new ApiResponse(200, 'Products retrieved successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const getProductById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const product = await Product.findOne({ _id: id, isDeleted: false })
    .populate('category', 'brand')
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  res.json(
    new ApiResponse(200, 'Product retrieved successfully', product)
  );
});

export const updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const existingProduct = await Product.findOne({ _id: id, isDeleted: false });
  if (!existingProduct) {
    throw new ApiError(404, 'Product not found');
  }

  if (updateData.sku && updateData.sku !== existingProduct.sku) {
    const existingSku = await Product.findOne({
      sku: updateData.sku,
      isDeleted: false,
      _id: { $ne: id }
    });
    if (existingSku) {
      throw new ApiError(400, 'Product with this SKU already exists');
    }
  }

  if (!updateData.slug && updateData.name && updateData.name !== existingProduct.name) {
    let base = slugify(updateData.name);
    let candidate = base;
    let i = 1;
    while (await Product.findOne({ slug: candidate, _id: { $ne: id } })) {
      candidate = `${base}-${i++}`;
    }
    updateData.slug = candidate;
  } else if (updateData.slug) {
    let base = slugify(updateData.slug);
    let candidate = base;
    let i = 1;
    while (await Product.findOne({ slug: candidate, _id: { $ne: id } })) {
      candidate = `${base}-${i++}`;
    }
    updateData.slug = candidate;
  }

  const result = await Product.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('category', 'brand');

  res.json(
    new ApiResponse(200, 'Product updated successfully', result)
  );
});

export const deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const result = await Product.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!result) {
    throw new ApiError(404, 'Product not found');
  }

  res.json(
    new ApiResponse(200, 'Product deleted successfully', result)
  );
});

export const getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isFeatured: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'Featured products retrieved successfully', products)
  );
});

export const getTrendingProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isTrending: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ rating: -1, reviewCount: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'Trending products retrieved successfully', products)
  );
});

export const getNewArrivalProducts = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.find({
    isNewArrival: true,
    status: 'active',
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(200, 'New arrival products retrieved successfully', products)
  );
});

export const getProductsByCategory = asyncHandler(async (req, res, next) => {
  const { categoryId } = req.params;
  const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID');
  }

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
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json(
    new ApiResponse(200, 'Products retrieved successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const searchProducts = asyncHandler(async (req, res, next) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q) {
    throw new ApiError(400, 'Search query is required');
  }

  const filter = {
    $text: { $search: q as string },
    status: 'active',
    isDeleted: false,
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter, { score: { $meta: 'textScore' } })
      .populate('category', 'brand')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json(
    new ApiResponse(200, 'Products found successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const getProductFilters = asyncHandler(async (req, res, next) => {
  const [brands, colors, sizes, priceRange] = await Promise.all([
    Product.distinct('brand', { status: 'active', isDeleted: false }),
    Product.distinct('specifications.color', { status: 'active', isDeleted: false }),
    Product.distinct('specifications.size', { status: 'active', isDeleted: false }),
    Product.aggregate([
      { $match: { status: 'active', isDeleted: false } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$pricing.basePrice' },
          maxPrice: { $max: '$pricing.basePrice' },
        },
      },
    ]),
  ]);

  const filters = {
    brands: brands.filter(Boolean),
    colors: colors.flat().filter(Boolean),
    sizes: sizes.flat().filter(Boolean),
    priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
  };

  res.json(
    new ApiResponse(200, 'Product filters retrieved successfully', filters)
  );
});
