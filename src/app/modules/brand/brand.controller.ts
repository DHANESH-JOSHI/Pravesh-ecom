import { redis } from "@/config/redis";
import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { RedisPatterns } from '@/utils/redisKeys';
import { CacheTTL } from "@/utils/cacheTTL";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
import { Product } from "../product/product.model";
import { Category } from "../category/category.model";

const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");

export const createBrand = asyncHandler(async (req, res) => {
  const { name, categoryIds } = brandValidation.parse(req.body);

  let brand = await Brand.findOne({ name, isDeleted: false });

  if (brand) {
    throw new ApiError(status.BAD_REQUEST, "Brand with this name already exists");
  }

  const deletedBrand = await Brand.findOne({ name, isDeleted: true });
  if (req.file && deletedBrand?.image) {
    const publicId = deletedBrand.image.split("/").pop()?.split(".")[0];
    if (publicId) await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
  }

  const image = req.file ? req.file.path : deletedBrand?.image || undefined;
  const expandedLeafIds = categoryIds?.length
    ? await expandToLeafCategories(categoryIds as any[])
    : [];
  if (deletedBrand) {
    deletedBrand.isDeleted = false;
    deletedBrand.name = name;
    deletedBrand.categories = expandedLeafIds as any[];
    deletedBrand.image = image;
    await deletedBrand.save();
    brand = deletedBrand;
  } else {
    brand = await Brand.create({
      name,
      categories: expandedLeafIds,
      image,
    });
  }

  await syncBrandCategories(brand._id as any, expandedLeafIds);
  
  // Invalidate this brand's cache by ID (new brand created)
  await redis.deleteByPattern(RedisPatterns.BRAND_ANY(String(brand._id)));
  // Invalidate brand cache by slug (new brand created)
  if (brand.slug) {
    await redis.deleteByPattern(RedisPatterns.BRAND_BY_SLUG_ANY(brand.slug));
  }
  // Invalidate all brand lists (new brand added to lists)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  
  // Invalidate category caches that have this brand (category brandCount increased)
  for (const categoryId of expandedLeafIds) {
    // Invalidate specific category cache (brandCount increased)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(categoryId)));
  }
  // Also check categories that have this brand in their brands array (from syncBrandCategories)
  const categoriesWithBrand = await Category.find({ brands: brand._id, isDeleted: false }).select('_id');
  for (const category of categoriesWithBrand) {
    const categoryIdStr = String(category._id);
    const alreadyInvalidated = expandedLeafIds.some(catId => String(catId) === categoryIdStr);
    if (!alreadyInvalidated) {
      // Invalidate category cache (brandCount increased)
      await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(categoryIdStr));
    }
  }
  if (expandedLeafIds.length > 0 || categoriesWithBrand.length > 0) {
    // Invalidate all category lists (brandCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  // Invalidate all product lists (products display brand info: name, slug)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display brand info: name, slug)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
  // Invalidate product filters (new brand might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate all order lists (orders display brand info: name, slug in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate all individual order caches (orders display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_INDIVIDUAL());
  // Invalidate all cart lists (carts display brand info: name in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());

  res
    .status(status.CREATED)
    .json(new ApiResponse(status.CREATED, "Brand created successfully", brand));
});

export const getAllBrands = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.BRANDS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Brands retrieved successfully", cached));

  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    sort = "createdAt",
    order = "desc",
    isDeleted = "false",
  } = req.query;
  const filter: any = { isDeleted: isDeleted === "true" };
  if (categoryId) {
    const allCategoryIds = await getLeafCategoryIds(categoryId as string);
    if (allCategoryIds.length === 0) {
      const result = { brands: [], total: 0, page: Number(page), totalPages: 0 };
      await redis.set(cacheKey, result, CacheTTL.SHORT);
      return res
        .status(status.OK)
        .json(new ApiResponse(status.OK, "Brands retrieved successfully", result));
    }
    const categoryObjectIds = allCategoryIds.map((id: string) => new mongoose.Types.ObjectId(id));
    filter.categories = { $in: categoryObjectIds };
  }

  const sortOrder = order === "asc" ? 1 : -1;
  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];
  let countFilter = { ...filter };

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const searchCriteria = {
      $or: [
        { name: { $regex: searchRegex } },
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
    // Use the same filter for countDocuments when search is provided
    countFilter = combinedMatch;
  } else {
    pipeline.push({ $match: filter });
  }
  pipeline.push({ $sort: { [sort as string]: sortOrder } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  const brands = await Brand.aggregate(pipeline);
  const total = await Brand.countDocuments(countFilter);

  const augmented = await Promise.all(
    brands.map(async (b) => {
      const [productCount, categoryCount] = await Promise.all([
        Product.countDocuments({ brand: b._id, isDeleted: false }),
        Category.countDocuments({ brands: b._id, isDeleted: false }),
      ]);

      return { ...b, productCount, categoryCount };
    })
  );

  const totalPages = Math.ceil(total / Number(limit));
  const result = { brands: augmented, total, page: Number(page), totalPages };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Brands retrieved successfully", result));
});

export const getBrandById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");

  const cacheKey = RedisKeys.BRAND_BY_ID(id, req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved", cached));

  const { populate = "false" } = req.query;
  const query = Brand.findOne({ _id: id }); // Allow viewing inactive brands
  const brand =
    populate === "true"
      ? await query.populate([
          { path: "categories", match: { isDeleted: false } },
          { path: "products", match: { isDeleted: false } },
        ])
      : await query;

  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  const brandObj = (brand as any)?.toObject ? (brand as any).toObject() : brand;
  await redis.set(cacheKey, brandObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brandObj));
});

export const getBrandBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = RedisKeys.BRAND_BY_SLUG(slug, req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved", cached));

  const { populate = "false" } = req.query;
  if (!slug || slug.trim() === "") {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand slug");
  }
  const query = Brand.findOne({ slug }); // Allow viewing inactive brands
  const brand =
    populate === "true"
      ? await query.populate([
          { path: "categories", match: { isDeleted: false } },
          { path: "products", match: { isDeleted: false } },
        ])
      : await query;

  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  const brandObj = (brand as any)?.toObject ? (brand as any).toObject() : brand;
  await redis.set(cacheKey, brandObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brandObj));
});

export const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, categoryIds } = brandUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");

  const brand = await Brand.findOne({ _id: id, isDeleted: false });
  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  const oldName = brand.name;
  const oldSlug = brand.slug;
  const oldCategoryIds = brand.categories.map(cat => String(cat));

  if (name && name !== brand.name) {
    const exists = await Brand.findOne({ name, _id: { $ne: id }, isDeleted: false });
    if (exists) throw new ApiError(status.BAD_REQUEST, "Brand name already exists");
  }

  if (req.file && brand.image) {
    const publicId = brand.image.split("/").pop()?.split(".")[0];
    if (publicId) await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
  }
  const expandedLeafIds = categoryIds?.length
    ? await expandToLeafCategories(categoryIds as any[])
    : [];
  
  brand.name = name || brand.name;
  brand.image = req.file ? req.file.path : brand.image;
  brand.categories = expandedLeafIds as any[];
  await brand.save();

  await syncBrandCategories(brand._id as any, expandedLeafIds);
  
  // Invalidate this brand's cache by ID (brand data changed)
  await redis.deleteByPattern(RedisPatterns.BRAND_ANY(String(id)));
  // Invalidate brand cache by old slug (slug might have changed)
  await redis.deleteByPattern(RedisPatterns.BRAND_BY_SLUG_ANY(oldSlug));
  
  // If slug changed, invalidate new slug cache
  if (brand.slug !== oldSlug) {
    await redis.deleteByPattern(RedisPatterns.BRAND_BY_SLUG_ANY(brand.slug));
  }
  
  // Invalidate all brand lists (brand data changed in lists)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  
  // Invalidate category caches that have this brand (category brandCount might have changed)
  const allAffectedCategoryIds = new Set([...oldCategoryIds, ...expandedLeafIds]);
  for (const categoryId of allAffectedCategoryIds) {
    // Invalidate specific category cache (brandCount changed)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(categoryId)));
  }
  // Also check categories that have this brand in their brands array
  const categoriesWithBrand = await Category.find({ brands: id, isDeleted: false }).select('_id');
  for (const category of categoriesWithBrand) {
    if (!allAffectedCategoryIds.has(String(category._id))) {
      // Invalidate category cache (brandCount might have changed)
      await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(category._id)));
    }
  }
  if (allAffectedCategoryIds.size > 0 || categoriesWithBrand.length > 0) {
    // Invalidate all category lists (brandCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  
  // If brand name changed, invalidate product caches (products display brand name)
  if (name && name !== oldName) {
    // Invalidate all product lists (products display brand name)
    await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
    // Invalidate all individual product caches (products display brand name, slug)
    await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
    // Invalidate product filters (brand name changed, might affect filter options)
    await redis.delete(RedisKeys.PRODUCT_FILTERS());
  }
  // Invalidate all order lists (orders display brand info: name, slug in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate all individual order caches (orders display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_INDIVIDUAL());
  // Invalidate all cart lists (carts display brand info: name in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());
  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Brand updated successfully", brand));
});

export const deleteBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");

  const brand = await Brand.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  // Invalidate this brand's cache by ID (brand deleted)
  await redis.deleteByPattern(RedisPatterns.BRAND_ANY(String(id)));
  // Invalidate brand cache by slug (brand deleted)
  await redis.deleteByPattern(RedisPatterns.BRAND_BY_SLUG_ANY(brand.slug));
  // Invalidate all brand lists (brand removed from lists)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  
  // Invalidate category caches that had this brand (category brandCount decreased)
  for (const categoryId of brand.categories) {
    // Invalidate specific category cache (brandCount decreased)
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(categoryId)));
  }
  // Also check categories that have this brand in their brands array
  const categoriesWithBrand = await Category.find({ brands: id, isDeleted: false }).select('_id');
  for (const category of categoriesWithBrand) {
    const categoryIdStr = String(category._id);
    const alreadyInvalidated = brand.categories.some(catId => String(catId) === categoryIdStr);
    if (!alreadyInvalidated) {
      // Invalidate category cache (brandCount decreased)
      await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(categoryIdStr));
    }
  }
  if (brand.categories.length > 0 || categoriesWithBrand.length > 0) {
    // Invalidate all category lists (brandCount changed in lists)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  }
  
  // Invalidate all product lists (products display brand info, brand is now deleted)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display brand info: name, slug)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
  // Invalidate product filters (brand deleted, might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate all order lists (orders display brand info: name, slug in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate all individual order caches (orders display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_INDIVIDUAL());
  // Invalidate all cart lists (carts display brand info: name in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display brand info in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());

  res.status(status.OK).json(new ApiResponse(status.OK, "Brand deleted successfully", brand));
});


const syncBrandCategories = async (brandId: mongoose.Types.ObjectId, newCategoryIds: string[]) => {
  await Category.updateMany(
    { brands: brandId, _id: { $nin: newCategoryIds } },
    { $pull: { brands: brandId } }
  );

  if (newCategoryIds.length > 0) {
    await Category.updateMany(
      { _id: { $in: newCategoryIds } },
      { $addToSet: { brands: brandId } }
    );
  }
}

const expandToLeafCategories = async (categoryIds: string[]) => {
  const leafIds = new Set<string>();

  for (const id of categoryIds) {
    const descendants = await getLeafCategoryIds(id);
    for (const d of descendants) leafIds.add(d);
  }
  return Array.from(leafIds);
}


export const getLeafCategoryIds = async (categoryId: string) => {
  // Validate categoryId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return [];
  }

  const categoryObjectId = new mongoose.Types.ObjectId(categoryId);

  const result = await Category.aggregate([
    { $match: { _id: categoryObjectId, isDeleted: false } },

    {
      $graphLookup: {
        from: "categories",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentCategory",
        as: "descendants",
        restrictSearchWithMatch: { isDeleted: false },
      },
    },

    {
      $project: {
        leafIds: {
          $map: {
            input: {
              $filter: {
                input: { $concatArrays: [["$_id"], "$descendants._id"] },
                as: "cat",
                cond: {
                  $not: {
                    $in: ["$$cat", "$descendants.parentCategory"],
                  },
                },
              },
            },
            as: "leaf",
            in: "$$leaf",
          },
        },
      },
    },
  ]);
  
  // If no result or category doesn't exist, return empty array
  if (!result || result.length === 0) {
    return [];
  }

  const leafIds =
    result[0]?.leafIds?.length > 0
      ? result[0].leafIds.map((id: any) => id.toString())
      : [categoryId];

  return leafIds;
};

