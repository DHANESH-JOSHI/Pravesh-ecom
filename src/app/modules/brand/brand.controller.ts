import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { getApiErrorClass,getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");


export const createBrand = asyncHandler(async (req, res) => {
    const { name } = brandValidation.parse(req.body);

    const existingBrand = await Brand.findOne({
        name,
        isDeleted: false,
    });
    if (existingBrand) {
        throw new ApiError(400, "Brand with this title already exists");
    }

    if (!req.file) {
        throw new ApiError(400, "Image is required");
    }

    const image = req.file.path

    const brand = new Brand({
        name,
        image,
    });
    await brand.save();

    res
        .status(201)
        .json(
            new ApiResponse(201, "Brand created successfully", brand)
        );
});

export const getAllBrands = asyncHandler(async (req, res) => {
    const brands = await Brand.find({ isDeleted: false }).sort({
        createdAt: -1,
    });

    if (brands.length === 0) {
        throw new ApiError(404, "No brands found");
    }

    res.json(new ApiResponse(200, "Brands retrieved successfully", brands));
});

export const getBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(400, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });

    if (!brand) {
        throw new ApiError(404, "Brand not found");
    }

    res.json(new ApiResponse(200, "Brand retrieved successfully", brand));
});

export const updateBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(400, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });

    if (!brand) {
        throw new ApiError(404, "Brand not found");
    }

    const updateData: { name?: string; image?: string; } = {};

    if (req.body.name) {
        if (req.body.name !== brand.name) {
            const existingBrand = await Brand.findOne({
                name: req.body.name,
                isDeleted: false,
                _id: { $ne: brandId },
            });

            if (existingBrand) {
                throw new ApiError(400, "Brand with this title already exists");
            }
        }
        updateData.name = req.body.name;
    }

    if (req.file) {
        updateData.image = req.file.path;

        if (brand.image) {
            const publicId = brand.image.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
            }
        }
    }

    if (Object.keys(updateData).length > 0) {
        const validatedData = brandUpdateValidation.parse(updateData);

        const updatedBrand = await Brand.findByIdAndUpdate(
            brandId,
            validatedData,
            { new: true }
        );

        res.json(
            new ApiResponse(200, "Brand updated successfully", updatedBrand)
        );
        return;
    }

    res.json(new ApiResponse(200, "No changes to update", brand));
});

export const deleteBrandById = asyncHandler(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(400, "Invalid brand ID");
    }
    const brand = await Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });
    if (!brand) {
        throw new ApiError(404, "Brand not found");
    }
    brand.isDeleted = true;
    await brand.save();
    res.json(new ApiResponse(200, "Brand deleted successfully", brand));
});