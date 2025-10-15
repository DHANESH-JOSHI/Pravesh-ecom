import { asyncHandler } from "@/utils";
import { AddressValidation } from "./address.validation";
import { Address } from "./address.model";
import status from "http-status";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
const ApiError = getApiErrorClass("ADDRESS");
const ApiResponse = getApiResponseClass("ADDRESS");


export const createAddress = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const validatedData = AddressValidation.parse(req.body);

    const address = await Address.create({
        ...validatedData,
        user: userId,
    })
    if (!address) {
        throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to create address");
    }
    res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Address created successfully", address));
})

export const updateMyAddress = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const addressId = req.params.id;
    const validatedData = AddressValidation.partial().parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid address ID");
    }
    const existingAddress = await Address.findOne({
        _id: addressId,
        user: userId,
        isDeleted: false,
    });
    if (!existingAddress) {
        throw new ApiError(status.NOT_FOUND, "Address not found or you are not authorized to update it");
    }
    const updatedAddress = await Address.findByIdAndUpdate(existingAddress._id, {
        ...validatedData,
    }, { new: true });
    res.status(status.OK).json(new ApiResponse(status.OK, "Address updated successfully", updatedAddress));
})

export const deleteMyAddress = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const addressId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid address ID");
    }
    const existingAddress = await Address.findOne({
        _id: addressId,
        user: userId,
        isDeleted: false,
    });
    if (!existingAddress) {
        throw new ApiError(status.NOT_FOUND, "Address not found or you are not authorized to delete it");
    }
    existingAddress.isDeleted = true;
    await existingAddress.save();
    res.status(status.OK).json(new ApiResponse(status.OK, "Address deleted successfully"));
})

export const getMyAddresses = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const addresses = await Address.find({ user: userId, isDeleted: false }).sort({ createdAt: -1 });
    res.status(status.OK).json(new ApiResponse(status.OK, "Addresses retrieved successfully", addresses));
})


export const getAllAddresses = asyncHandler(async (req, res) => {
    const addresses = await Address.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.status(status.OK).json(new ApiResponse(status.OK, "All addresses retrieved successfully", addresses));
})