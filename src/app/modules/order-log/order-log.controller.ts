import { asyncHandler } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { 
  getOrderLog,
  getAllLogs,
  getAllAnalytics
} from './order-log.service';
import status from 'http-status';
import mongoose, { Types } from 'mongoose';
import { logger } from "@/config/logger";

const ApiError = getApiErrorClass("ORDER_LOG");
const ApiResponse = getApiResponseClass("ORDER_LOG");

export const getOrderLogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid log ID');
  }

  const log = await getOrderLog(id);

  if (!log) {
    throw new ApiError(status.NOT_FOUND, 'Log not found');
  }

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order log retrieved successfully', log)
  );
});

export const getAllLogsController = asyncHandler(async (req, res) => {
  const adminId = req.user?._id as string | Types.ObjectId | undefined;
  const userRole = req.user?.role as string | undefined;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const orderId = req.query.orderId as string | undefined;
  const staffId = req.query.staffId as string | undefined;
  const action = req.query.action as string | undefined;
  const field = req.query.field as string | undefined;
  const search = req.query.search as string | undefined;

  const effectiveStaffId = userRole === "staff" && adminId ? String(adminId) : staffId;

  const filters = {
    page,
    limit,
    orderId,
    staffId: effectiveStaffId,
    action: action && action !== "all" ? action : undefined,
    field: field && field !== "all" ? field : undefined,
    search: search && search.trim() ? search.trim() : undefined,
  };

  const result = await getAllLogs(filters);

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order logs retrieved successfully', result)
  );
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
    logger.error("Error in getAllAnalyticsController:", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError(status.INTERNAL_SERVER_ERROR, error.message || 'Failed to retrieve analytics');
  }
});

