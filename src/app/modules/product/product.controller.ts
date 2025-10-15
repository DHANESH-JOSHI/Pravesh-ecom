import { Product } from './product.model';
import { asyncHandler } from '@/utils';
import { cloudinary } from '@/config/cloudinary';
import { getApiErrorClass,getApiResponseClass } from '@/interface';
import { createProductValidation, productsQueryValidation } from './product.validation';
import { Category } from '../category/category.model';
import { Brand } from '../brand/brand.model';
import { IProductQuery, ProductStatus } from './product.interface';
import status from 'http-status';
const ApiError = getApiErrorClass("PRODUCT");
const ApiResponse = getApiResponseClass("PRODUCT");
// Create a new product
const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const createProduct = asyncHandler(async (req, res) => {
  const productData = createProductValidation.parse(req.body);
  // Check if SKU already exists
  const existingSku = await Product.findOne({ sku: productData.sku, isDeleted: false });
  if (existingSku) {
    throw new ApiError(status.BAD_REQUEST, 'Product with this SKU already exists');
  }

  if (productData.category) {
    const existingCategory = await Category.findById(productData.category);
    if (!existingCategory) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid category ID');
    }
  }
  if (productData.brand) {
    const existingBrand = await Brand.findById(productData.brand);
    if (!existingBrand) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid brand ID');
    }
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

  if (req.files && typeof req.files === 'object') {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
      productData.thumbnail = files['thumbnail'][0].path;
    }
    if (Array.isArray(files['images'])) {
      productData.images = files['images'].map((file) => file.path);
    }
  }

  const result = await Product.create(productData);
  const populatedResult = await Product.findById(result._id).populate('category brand');

  res.status(status.CREATED).json(
    new ApiResponse(status.CREATED, 'Product created successfully', populatedResult)
  );
});

export const getDiscountProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const products = await Product.find({
    isDiscount: true,
    status: ProductStatus.Active,
    isDeleted: false,
  })
    .populate('category', 'brand')
    .sort({ discountValue: -1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  res.json(
    new ApiResponse(status.OK, 'Discount products retrieved successfully', products)
  );
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params as { slug: string };

  const product = await Product.findOne({ slug, isDeleted: false })
    .populate('category', 'brand')
    .lean();

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  res.json(
    new ApiResponse(status.OK, 'Product retrieved successfully', product)
  );
});

export const getAllProducts = asyncHandler(async (req, res) => {
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
    status:productStatus = 'active',
    stockStatus = 'in_stock',
    isFeatured,
    isNewArrival,
    isDiscount,
    rating,
    search,
    isDeleted = false,
  } = productsQueryValidation.parse(req.query) as IProductQuery;

  // Build filter object
  const filter: any = {
    isDeleted,
    stockStatus,
    status:productStatus,
    isFeatured,
    isNewArrival,
    isDiscount,
    rating,
    category,
    brand,
  };
  if (inStock) {
    filter.stock = { $gt: 0 };
  }
  // Price range filter
  if (minPrice || maxPrice) {
    filter.finalPrice = {};
    if (minPrice) filter.finalPrice.$gte = Number(minPrice);
    if (maxPrice) filter.finalPrice.$lte = Number(maxPrice);
  }

  // Rating filter
  if (rating) {
    filter.rating = { $gte: Number(rating) };
  }
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
      .populate('category brand')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json(
    new ApiResponse(status.OK, 'Products retrieved successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findOne({ _id: id, isDeleted: false })
    .populate('category', 'brand')
    .lean();

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  res.json(
    new ApiResponse(status.OK, 'Product retrieved successfully', product)
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData: any = createProductValidation.partial().parse(req.body);

  const existingProduct = await Product.findOne({ _id: id, isDeleted: false });
  if (!existingProduct) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
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

  if (req.files && typeof req.files === 'object') {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
      updateData.thumbnail = files['thumbnail'][0].path;
      // Delete old thumbnail from Cloudinary
      if (existingProduct.thumbnail) {
        const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
        }
      }
    }

    if (Array.isArray(files['images']) && files['images'].length > 0) {
      updateData.images = files['images'].map((file) => file.path);
      // Delete old images from Cloudinary
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
    updateData,
    { new: true, runValidators: true }
  ).populate('category', 'brand');

  res.json(
    new ApiResponse(status.OK, 'Product updated successfully', result)
  );
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await Product.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!result) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  res.json(
    new ApiResponse(status.OK, 'Product deleted successfully', result)
  );
});

export const getFeaturedProducts = asyncHandler(async (req, res) => {
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
    new ApiResponse(status.OK, 'Featured products retrieved successfully', products)
  );
});

// export const getTrendingProducts = asyncHandler(async (req, res) => {
//   const { limit = 10 } = req.query;

//   const products = await Product.find({
//     isTrending: true,
//     status: 'active',
//     isDeleted: false,
//   })
//     .populate('category', 'brand')
//     .sort({ rating: -1, reviewCount: -1 })
//     .limit(Number(limit))
//     .lean();

//   res.json(
//     new ApiResponse(status.OK, 'Trending products retrieved successfully', products)
//   );
// });

export const getNewArrivalProducts = asyncHandler(async (req, res) => {
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
    new ApiResponse(status.OK, 'New arrival products retrieved successfully', products)
  );
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
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
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json(
    new ApiResponse(status.OK, 'Products retrieved successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q) {
    throw new ApiError(status.BAD_REQUEST, 'Search query is required');
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
    new ApiResponse(status.OK, 'Products found successfully', {
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    })
  );
});

export const getProductFilters = asyncHandler(async (req, res) => {
  const [brands, categories, colors, sizes, priceRange] = await Promise.all([
    Product.distinct('brand', { status: 'active', isDeleted: false }),
    Product.distinct('category', { status: 'active', isDeleted: false }),
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
    brands: brands.filter(Boolean),
    categories: categories.filter(Boolean),
    colors: colors.flat().filter(Boolean),
    sizes: sizes.flat().filter(Boolean),
    priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
  };

  res.json(
    new ApiResponse(status.OK, 'Product filters retrieved successfully', filters)
  );
});
