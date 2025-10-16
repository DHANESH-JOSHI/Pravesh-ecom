import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");

export const createBrand = asyncHandler(async (req, res) => {
    const { name } = brandValidation.parse(req.body);

    const existingBrand = await Brand.findOne({
        name,
        isDeleted: false,
    });
    if (existingBrand) {
        throw new ApiError(status.BAD_REQUEST, "Brand with this title already exists");
    }

    if (!req.file) {
        throw new ApiError(status.BAD_REQUEST, "Image is required");
    }

    const image = req.file.path

    const brand = new Brand({
        name,
        image,
    });
    await brand.save();

    res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Brand created successfully", brand));
});

export const getAllBrands = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [brands, total] = await Promise.all([
        Brand.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Brand.countDocuments({ isDeleted: false }),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    res.status(status.OK).json(new ApiResponse(status.OK, "Brands retrieved successfully", {
        brands,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    }));
});

export const getBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });

    if (!brand) {
        throw new ApiError(status.NOT_FOUND, "Brand not found");
    }

    res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brand));
});

export const updateBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    const { name } = brandUpdateValidation.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });

    if (!brand) {
        throw new ApiError(status.NOT_FOUND, "Brand not found");
    }

    if (name) {
        if (name !== brand.name) {
            const existingBrand = await Brand.findOne({
                name,
                isDeleted: false,
                _id: { $ne: brandId },
            });

            if (existingBrand) {
                throw new ApiError(status.BAD_REQUEST, "Brand with this name already exists");
            }
        }
    }

    if (req.file) {
        if (brand.image) {
            const publicId = brand.image.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
            }
        }
    }
    const updatedBrand = await Brand.findByIdAndUpdate(
        brandId,
        {
            name,
            image: req.file ? req.file.path : brand.image,
        },
        { new: true }
    );

    res.status(status.OK).json(
        new ApiResponse(status.OK, "Brand updated successfully", updatedBrand)
    );
});

export const deleteBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });
    if (!brand) {
        throw new ApiError(status.NOT_FOUND, "Brand not found");
    }
    brand.isDeleted = true;
    await brand.save();
    res.json(new ApiResponse(status.OK, "Brand deleted successfully", brand));
});