import { asyncHandler } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { 
  getOrderLogs, 
  getRecentLogs,
  getLogsByStaffId,
  getUserLogAnalytics,
  getAllAnalytics
} from './order-log.service';
import status from 'http-status';
import mongoose from 'mongoose';

const ApiError = getApiErrorClass("ORDER_LOG");
const ApiResponse = getApiResponseClass("ORDER_LOG");

export const getOrderLogsByOrderId = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid order ID');
  }

  const logs = await getOrderLogs(orderId, limit);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order logs retrieved successfully', logs)
  );
});

export const getRecentOrderLogs = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;

  const result = await getRecentLogs(limit, skip);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Recent order logs retrieved successfully', result)
  );
});

export const getLogsByStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const page = parseInt(req.query.page as string) || 1;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid staff ID');
  }

  const result = await getLogsByStaffId(staffId, limit, skip);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Staff logs retrieved successfully', result)
  );
});

export const getUserLogAnalyticsController = asyncHandler(async (req, res) => {
  try {
    const { staffId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid staff ID');
    }

    const analytics = await getUserLogAnalytics(staffId, days);

    res.status(status.OK).json(
      new ApiResponse(status.OK, 'User log analytics retrieved successfully', analytics)
    );
  } catch (error: any) {
    console.error("Error in getUserLogAnalyticsController:", error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, error.message || 'Failed to retrieve user log analytics');
  }
});

export const getAllAnalyticsController = asyncHandler(async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const dailyDays = parseInt(req.query.dailyDays as string) || 30;

    const analytics = await getAllAnalytics(days, dailyDays);

    res.status(status.OK).json(
      new ApiResponse(status.OK, 'All analytics retrieved successfully', analytics)
    );
  } catch (error: any) {
    console.error("Error in getAllAnalyticsController:", error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, error.message || 'Failed to retrieve analytics');
  }
});

