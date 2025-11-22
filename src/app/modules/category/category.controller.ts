import mongoose from "mongoose";
import status from "http-status";
import { Category } from "./category.model";
import { Brand } from "../brand/brand.model";
import { asyncHandler, generateCacheKey } from "@/utils";
import { redis } from "@/config/redis";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import { ICategory } from "./category.interface";
import { Product } from "../product/product.model";
import { getLeafCategoryIds } from "../brand/brand.controller";

const ApiError = getApiErrorClass("CATEGORY");
const ApiResponse = getApiResponseClass("CATEGORY");


export const createCategory = asyncHandler(async (req, res) => {
  const { title, parentCategoryId } = categoryValidation.parse(req.body);

  let category = await Category.findOne({ title, parentCategory: parentCategoryId || null });

  if (category && !category.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, "Category with this title already exists under same parent");
  }

  if (!category) {
    category = await Category.create({
      title,
      parentCategory: parentCategoryId || null,
    });
  } else {
    category.isDeleted = false;
    category.title = title;
    category.parentCategory = parentCategoryId;
    await category.save();
  }
  await redis.deleteByPattern("categories*");

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Category created", category));
});


export const getAllCategories = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey("categories", req.query);
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
    const brand = await Brand.findById(brandId).select("categories");
    filter._id = { $in: brand?.categories || [] };
  }

  const sortOrder = order === "desc" ? -1 : 1;
  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    pipeline.push({
      $search: {
        index: "category_search",
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

  pipeline.push({ $sort: { [sort as string]: sortOrder } });

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "parentCategory",
      foreignField: "_id",
      pipeline: [
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

  await redis.set(cacheKey, result, 3600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Categories retrieved", result));
});


export const getCategoryTree = asyncHandler(async (req, res) => {
  const cacheKey = "categories:tree";
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
  await redis.set(cacheKey, tree, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, "Category tree retrieved", tree));
});

export const getLeafCategories = asyncHandler(async (_, res) => {
  const cacheKey = "categories:leaf";
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Leaf categories retrieved", cached));

  const leafs = await Category.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "parentCategory",
        as: "children",
      },
    },
    { $match: { children: { $size: 0 } } },
    { $project: { _id: 1, title: 1, slug: 1 } },
  ]);

  await redis.set(cacheKey, leafs, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, "Leaf categories retrieved", leafs));
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(status.BAD_REQUEST, "Invalid category ID");

  const cacheKey = generateCacheKey(`category:${id}`, req.query);
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", cached));
  const { populate = "false" } = req.query;
  const query = Category.findOne({ _id: id, isDeleted: false })

  const category = populate === "true" ? await query.populate("parentCategory children brands") : await query.populate("parentCategory", "slug title");

  if (!category) throw new ApiError(status.NOT_FOUND, "Category not found");

  await redis.set(cacheKey, category, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", category));
});


export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = generateCacheKey(`category:${slug}`, req.query);
  const cached = await redis.get(cacheKey);
  if (cached) return res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved", cached));
  const { populate = "false" } = req.query;
  const query = Category.findOne({ slug, isDeleted: false })
  const category = populate === "true" ? await query.populate("parentCategory children brands") : await query.populate("parentCategory", "slug title");

  if (!category) throw new ApiError(status.NOT_FOUND, "Category not found");

  await redis.set(cacheKey, category, 3600);
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


  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      title,
      parentCategory: parentCategoryId,
      // image: req.file ? req.file.path : category.image,
    },
    { new: true }
  );

  await redis.deleteByPattern("categories*");
  await redis.deleteByPattern(`category:${category._id}*`);
  for (const brand of category.brands) {
    await redis.delete(`brand:${brand}?populate=true`);
  }

  res.status(status.OK).json(
    new ApiResponse(status.OK, "Category updated successfully", updatedCategory)
  );
  return;
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(status.BAD_REQUEST, "Invalid ID");

  const deleted = await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  if (!deleted) throw new ApiError(status.NOT_FOUND, "Category not found");
  await Brand.updateMany(
    { categories: id },
    { $pull: { categories: id } }
  );

  await Product.updateMany(
    { category: id },
    { $unset: { category: "" } }
  );

  await redis.deleteByPattern("categories*");
  await redis.deleteByPattern(`category:${id}*`);
  for (const brand of deleted.brands) {
    await redis.delete(`brand:${brand}?populate=true`);
  }

  res.status(status.OK).json(new ApiResponse(status.OK, "Category deleted", deleted));
});

async function countBrands(categoryId: mongoose.Types.ObjectId) {
  const result = await Category.aggregate([
    { $match: { _id: categoryId } },
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
  const allIds = await getLeafCategoryIds(categoryId)

  return Product.countDocuments({
    isDeleted: false,
    category: { $in: allIds }
  });
}