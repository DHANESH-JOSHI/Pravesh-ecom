import mongoose from "mongoose";
import status from "http-status";
import { Category } from "./category.model";
import { Brand } from "../brand/brand.model";
import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { CacheTTL } from "@/utils/cacheTTL";
import { redis } from "@/config/redis";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import { ICategory } from "./category.interface";
import { Product } from "../product/product.model";
import { getLeafCategoryIds } from "../brand/brand.controller";
import { RedisPatterns } from "@/utils/redisKeys";

const ApiError = getApiErrorClass("CATEGORY");
const ApiResponse = getApiResponseClass("CATEGORY");


export const createCategory = asyncHandler(async (req, res) => {
  const { title, parentCategoryId } = categoryValidation.parse(req.body);

  let category = await Category.findOne({ title, parentCategory: parentCategoryId || null, isDeleted: false });

  if (category) {
    throw new ApiError(status.BAD_REQUEST, "Category with this title already exists under same parent");
  }

  const deletedCategory = await Category.findOne({ title, parentCategory: parentCategoryId || null, isDeleted: true });
  if (deletedCategory) {
    deletedCategory.isDeleted = false;
    deletedCategory.title = title;
    deletedCategory.parentCategory = parentCategoryId;
    await deletedCategory.save();
    category = deletedCategory;
  } else {
    category = await Category.create({
      title,
      parentCategory: parentCategoryId || null,
    });
  }
  // Invalidate all category lists (new category added to lists)
  await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  // Invalidate category tree (new category added, tree structure changed)
  await redis.delete(RedisKeys.CATEGORY_TREE());
  // Invalidate leaf categories list (new category might be a leaf)
  await redis.delete(RedisKeys.CATEGORY_LEAF());
  
  // If category has a parent, invalidate parent cache (parent's childCount increased)
  if (parentCategoryId) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(parentCategoryId)));
  }
  
  // Invalidate this category's cache by slug (new category created)
  if (category && category.slug) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_BY_SLUG_ANY(category.slug));
  }

  // Invalidate brand caches (brands display categoryCount, new category might affect counts)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  // Invalidate all product lists (products display category info: title, slug, path)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display category info: title, slug, path)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
  // Invalidate product filters (new category might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate all order lists (orders display category info: title, slug, path in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate all individual order caches (orders display category info in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_INDIVIDUAL());
  // Invalidate all cart lists (carts display category info: title in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display category info in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Category created", category));
});


export const getAllCategories = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.CATEGORIES_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached) {
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Categories retrieved", cached));
  }

  const {
    page = 1,
    limit = 20,
    search,
    parentCategoryId,
    brandId,
    isDeleted = "false",
    sort = "createdAt",
    order = "desc",
  } = req.query;

  const filter: any = {
    isDeleted: isDeleted === "true",
  };

  if (parentCategoryId) {
    filter.parentCategory =
      parentCategoryId === "null" ? null : parentCategoryId;
  }

  if (brandId) {
    const brand = await Brand.findOne({ _id: brandId, isDeleted: false }).select("categories");
    if (!brand) {
      // If brand doesn't exist, return empty result
      const result = { categories: [], total: 0, page: Number(page), totalPages: 0 };
      await redis.set(cacheKey, result, CacheTTL.SHORT);
      return res
        .status(status.OK)
        .json(new ApiResponse(status.OK, "Categories retrieved", result));
    }
    // Ensure categories are ObjectIds (they should already be, but ensure type safety)
    const categoryObjectIds = (brand.categories || []).map((catId: any) => 
      catId instanceof mongoose.Types.ObjectId ? catId : new mongoose.Types.ObjectId(catId)
    );
    if (categoryObjectIds.length === 0) {
      // If brand has no categories, return empty result
      const result = { categories: [], total: 0, page: Number(page), totalPages: 0 };
      await redis.set(cacheKey, result, CacheTTL.SHORT);
      return res
        .status(status.OK)
        .json(new ApiResponse(status.OK, "Categories retrieved", result));
    }
    filter._id = { $in: categoryObjectIds };
  }

  const sortOrder = order === "desc" ? -1 : 1;
  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

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

} else {
    pipeline.push({ $match: filter });
}

  pipeline.push({ $sort: { [sort as string]: sortOrder } });

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "parentCategory",
      foreignField: "_id",
      pipeline: [
        { $match: { isDeleted: false } },
        {
          $project: {
            _id: 1,
            title: 1,
            slug: 1,
          },
        },
      ],
      as: "parentCategory",
    },
  });

  pipeline.push({
    $unwind: {
      path: "$parentCategory",
      preserveNullAndEmptyArrays: true,
    },
  });

  const categories = await Category.aggregate(pipeline);

  const total = await Category.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const augmented = await Promise.all(
    categories.map(async (c) => {
      const [productCount, childCount, brandCount] = await Promise.all([
        countProducts(c._id),
        Category.countDocuments({ parentCategory: c._id, isDeleted: false }),
        countBrands(c._id),
      ]);

      return {
        ...c,
        productCount,
        childCount,
        brandCount,
      };
    })
  );

  const result = {
    categories: augmented,
    total,
    page: Number(page),
    totalPages,
  };

  await redis.set(cacheKey, result, CacheTTL.XLONG);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Categories retrieved", result));
});


export const getCategoryTree = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.CATEGORY_TREE();
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Category tree retrieved", cached));

  const buildTree = async (parent = null) => {
    const nodes: ICategory[] = await Category.find({ parentCategory: parent, isDeleted: false }).select("title slug path");
    const children: ICategory[] = await Promise.all(
      nodes.map(async (n) => ({ ...n.toObject(), children: await buildTree(n._id as any) }))
    );
    return children;
  };

  const tree = await buildTree(null);
  await redis.set(cacheKey, tree, CacheTTL.XLONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Category tree retrieved", tree));
});

export const getLeafCategories = asyncHandler(async (_, res) => {
  const cacheKey = RedisKeys.CATEGORY_LEAF();
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Leaf categories retrieved", cached));

  const leafs = await Category.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "parentCategory",
        pipeline: [
          { $match: { isDeleted: false } },
          { $project: { _id: 1 } }
        ],
        as: "children",
      },
    },
    { $match: { children: { $size: 0 } } },
    { $project: { _id: 1, title: 1, slug: 1 } },
  ]);

  await redis.set(cacheKey, leafs, CacheTTL.XLONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Leaf categories retrieved", leafs));
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(status.BAD_REQUEST, "Invalid category ID");

  const cacheKey = RedisKeys.CATEGORY_BY_ID(id, req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", cached));
  const { populate = "false" } = req.query;
  const query = Category.findOne({ _id: id })

  const category = populate === "true"
    ? await query.populate([
        { path: "parentCategory", select: "_id title slug", match: { isDeleted: false } },
        { path: "children", select: "_id title slug path", match: { isDeleted: false } },
        { path: "brands", select: "_id name slug image createdAt updatedAt", match: { isDeleted: false } },
      ])
    : await query.populate({ path: "parentCategory", select: "slug title", match: { isDeleted: false } });

  if (!category) throw new ApiError(status.NOT_FOUND, "Category not found");

  const categoryObj = category.toObject ? category.toObject() : category;
  await redis.set(cacheKey, categoryObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", category));
});


export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = RedisKeys.CATEGORY_BY_SLUG(slug, req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", cached));
  const { populate = "false" } = req.query;
  const query = Category.findOne({ slug })
  const category = populate === "true"
    ? await query.populate([
        { path: "parentCategory", select: "_id title slug", match: { isDeleted: false } },
        { path: "children", select: "_id title slug path", match: { isDeleted: false } },
        { path: "brands", select: "_id name slug image createdAt updatedAt", match: { isDeleted: false } },
      ])
    : await query.populate({ path: "parentCategory", select: "slug title", match: { isDeleted: false } });

  if (!category) throw new ApiError(status.NOT_FOUND, "Category not found");

  const categoryObj = category.toObject ? category.toObject() : category;
  await redis.set(cacheKey, categoryObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", category));
});

export const updateCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const { title, parentCategoryId } = categoryUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid Category ID");
  }
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }
  if (title) {
    if (title !== category.title) {
      const existingCategory = await Category.findOne({
        title,
        isDeleted: false,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this title already exists");
      }
    }
  }

  if (parentCategoryId) {
    if (parentCategoryId !== category.parentCategory) {
      const existingParentCategory = await Category.findOne({
        _id: parentCategoryId,
        isDeleted: false,
      });
      if (!existingParentCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this parentCategory does not exist");
      }
    }
  }

  // if (req.file) {
  //   if (category.image) {
  //     const publicId = category.image.split("/").pop()?.split(".")[0];
  //     if (publicId) {
  //       await cloudinary.uploader.destroy(`pravesh-categories/${publicId}`);
  //     }
  //   }
  // }


  const oldParentCategoryId = category.parentCategory ? String(category.parentCategory) : undefined;
  const newParentCategoryId = parentCategoryId || undefined;
  const oldSlug = category.slug;

  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      title,
      parentCategory: parentCategoryId,
      // image: req.file ? req.file.path : category.image,
    },
    { new: true }
  );

  // Invalidate this category's cache by ID (category data changed)
  await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(category._id)));
  // Invalidate category cache by old slug (slug might have changed)
  await redis.deleteByPattern(RedisPatterns.CATEGORY_BY_SLUG_ANY(oldSlug));
  
  // If slug changed, invalidate new slug cache
  if (updatedCategory && updatedCategory.slug !== oldSlug) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_BY_SLUG_ANY(updatedCategory.slug));
  }
  
  // If category had a parent, invalidate old parent cache (old parent's childCount decreased)
  if (oldParentCategoryId) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(oldParentCategoryId));
  }
  
  // If parent changed, invalidate new parent cache (new parent's childCount increased)
  if (oldParentCategoryId !== newParentCategoryId && newParentCategoryId) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(newParentCategoryId));
  }
  
  // Invalidate all category lists (category data changed in lists)
  await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
  
  // If parent changed, invalidate tree structure and child category caches
  if (oldParentCategoryId !== newParentCategoryId) {
    // Invalidate category tree (parent changed, tree structure changed)
    await redis.delete(RedisKeys.CATEGORY_TREE());
    // Invalidate leaf categories list (category might have become/stopped being a leaf)
    await redis.delete(RedisKeys.CATEGORY_LEAF());
    // Invalidate all child category individual caches (child categories display parentCategory info)
    await redis.deleteByPattern(RedisPatterns.CATEGORIES_INDIVIDUAL());
  }

  // Invalidate brand caches (brands display categoryCount, category data changed)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  // Invalidate all product lists (products display category info: title, slug, path)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display category info: title, slug, path)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
  // Invalidate product filters (category data changed, might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());
  // Invalidate all order lists (orders display category info: title, slug, path in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate all individual order caches (orders display category info in product items)
  await redis.deleteByPattern(RedisPatterns.ORDERS_INDIVIDUAL());
  // Invalidate all cart lists (carts display category info: title in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display category info in product items)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());

  res.status(status.OK).json(
    new ApiResponse(status.OK, "Category updated successfully", updatedCategory)
  );
  return;
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(status.BAD_REQUEST, "Invalid ID");

  const deleted = await Category.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!deleted) throw new ApiError(status.NOT_FOUND, "Category not found");

  // Invalidate this category's cache by ID (category deleted)
  await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(id)));
  // Invalidate category cache by slug (category deleted)
  await redis.deleteByPattern(RedisPatterns.CATEGORY_BY_SLUG_ANY(deleted.slug));
  
  // If category had a parent, invalidate parent cache (parent's childCount decreased)
  if (deleted.parentCategory) {
    await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(String(deleted.parentCategory)));
  }
  
  // Invalidate category tree (category deleted, tree structure changed)
  await redis.delete(RedisKeys.CATEGORY_TREE());
  // Invalidate leaf categories list (category deleted, leaf list changed)
  await redis.delete(RedisKeys.CATEGORY_LEAF());
  // Invalidate all category lists (category removed from lists)
  await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());

  // Invalidate brand caches (brands display categoryCount, category deleted affects counts)
  await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
  // Invalidate all product lists (products display category info, category is now deleted)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display category info: title, slug, path)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());
  // Invalidate product filters (category deleted, might affect filter options)
  await redis.delete(RedisKeys.PRODUCT_FILTERS());

  res.status(status.OK).json(new ApiResponse(status.OK, "Category deleted", deleted));
});

async function countBrands(categoryId: mongoose.Types.ObjectId) {
  const result = await Category.aggregate([
    { $match: { _id: categoryId, isDeleted: false } },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentCategory',
        as: 'descendants',
        restrictSearchWithMatch: { isDeleted: false }
      }
    },
    {
      $project: {
        descendantIds: {
          $map: {
            input: '$descendants',
            as: 'd',
            in: '$$d._id'
          }
        }
      }
    },
    {
      $lookup: {
        from: 'brands',
        let: { dIds: '$descendantIds' },
        pipeline: [
          { $match: { isDeleted: false } },
          {
            $match: {
              $expr: {
                $gt: [
                  {
                    $size: {
                      $setIntersection: ['$categories', '$$dIds']
                    }
                  },
                  0
                ]
              }
            }
          }
        ],
        as: 'matchedBrands'
      }
    },
    {
      $project: {
        _id: 0,
        brandCount: { $size: '$matchedBrands' }
      }
    }
  ]);

  return result[0]?.brandCount || 0;
}
async function countProducts(categoryId: string) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return 0;
  }
  const allIds = await getLeafCategoryIds(categoryId);
  if (allIds.length === 0) {
    return 0;
  }
  // Convert string IDs to ObjectIds for MongoDB query
  const categoryObjectIds = allIds.map((id: string) => new mongoose.Types.ObjectId(id));
  return Product.countDocuments({
    isDeleted: false,
    category: { $in: categoryObjectIds }
  });
}