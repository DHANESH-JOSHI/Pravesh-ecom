import { redis } from "@/config/redis";
import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
import { Product } from "../product/product.model";
import { Category } from "../category/category.model";

const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");

export const createBrand = asyncHandler(async (req, res) => {
  const { name, categoryIds } = brandValidation.parse(req.body);

  let brand = await Brand.findOne({ name });

  if (brand && !brand.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, "Brand with this name already exists");
  }

  if (req.file && brand?.image) {
    const publicId = brand.image.split("/").pop()?.split(".")[0];
    if (publicId) await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
  }

  const image = req.file ? req.file.path : brand?.image || undefined;
  const expandedLeafIds = categoryIds?.length
    ? await expandToLeafCategories(categoryIds as any[])
    : [];
  if (!brand) {
    brand = await Brand.create({
      name,
      categories: expandedLeafIds,
      image,
    });
  } else {
    brand.isDeleted = false;
    brand.name = name;
    brand.categories = expandedLeafIds as any[];
    brand.image = image;
    await brand.save();
  }

  await syncBrandCategories(brand._id as any, expandedLeafIds);
  await redis.deleteByPattern("brands*");

  res
    .status(status.CREATED)
    .json(new ApiResponse(status.CREATED, "Brand created successfully", brand));
});

export const getAllBrands = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey("brands", req.query);
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
    filter.categories = { $in: allCategoryIds };
  }

  const sortOrder = order === "asc" ? 1 : -1;
  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    pipeline.push({
      $search: {
        index: "autocomplete_index",
        autocomplete: {
          query: search,
          path: "name",
          fuzzy: { maxEdits: 1 },
        },
      },
    });
  }

  pipeline.push({ $match: filter });
  pipeline.push({ $sort: { [sort as string]: sortOrder } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  const brands = await Brand.aggregate(pipeline);
  const total = await Brand.countDocuments(filter);

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

  await redis.set(cacheKey, result, 3600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Brands retrieved successfully", result));
});

export const getBrandById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");

  const cacheKey = generateCacheKey(`brand:${id}`, req.query);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved", cached));

  const { populate = "false" } = req.query;
  const query = Brand.findOne({ _id: id, isDeleted: false });
  const brand =
    populate === "true"
      ? await query.populate("categories products")
      : await query;

  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  await redis.set(cacheKey, brand, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brand));
});

export const getBrandBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = generateCacheKey(`brand:${slug}`, req.query);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved", cached));

  const { populate = "false" } = req.query;
  if (!slug || slug.trim() === "") {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand slug");
  }
  const query = Brand.findOne({ slug, isDeleted: false });
  const brand =
    populate === "true"
      ? await query.populate("categories products")
      : await query;

  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

  await redis.set(cacheKey, brand, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brand));
});

export const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, categoryIds } = brandUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");

  const brand = await Brand.findOne({ _id: id, isDeleted: false });
  if (!brand) throw new ApiError(status.NOT_FOUND, "Brand not found");

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
  await redis.deleteByPattern("brands*");
  await redis.deleteByPattern(`brand:${id}*`);
  for (const categoryId of brand.categories) {
    await redis.delete(`category:${categoryId}?populate=true`);
  }
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

  // Remove brand from categories
  await Category.updateMany(
    { brands: id },
    { $pull: { brands: id } }
  );

  // Optionally: nullify brand in products
  await Product.updateMany(
    { brand: id },
    { $unset: { brand: "" } }
  );


  await redis.deleteByPattern("brands*");
  await redis.deleteByPattern(`brand:${id}*`);
  for (const categoryId of brand.categories) {
    await redis.delete(`category:${categoryId}?populate=true`);
  }

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
  const leafIds =
    result[0]?.leafIds?.length > 0
      ? result[0].leafIds.map((id: any) => id.toString())
      : [categoryId];

  return leafIds;
};

