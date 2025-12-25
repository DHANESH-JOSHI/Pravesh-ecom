import { OrderLog } from "./order-log.model";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { OrderLogAction, OrderLogField } from "./order-log.interface";

interface LogOrderChangeParams {
  orderId?: string | Types.ObjectId; // Optional for list views
  adminId: string | Types.ObjectId;
  action: OrderLogAction | string; // Allow string for backward compatibility
  field?: OrderLogField | string; // Allow string for backward compatibility
  oldValue?: any;
  newValue?: any;
  description: string;
  metadata?: Record<string, any>;
}

export const logOrderChange = async (params: LogOrderChangeParams) => {
  try {
    await OrderLog.create({
      order: params.orderId || undefined,
      admin: params.adminId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      description: params.description,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("Failed to log order change:", error);
    // Don't throw - logging should not break the main flow
  }
};

export const getOrderLog = async (logId: string | Types.ObjectId) => {
  return await OrderLog.findById(logId)
    .populate("admin", "name email role")
    .populate("order", "status orderNumber user")
    .lean();
};

export const getAllLogs = async (filters: {
  page?: number;
  limit?: number;
  orderId?: string;
  staffId?: string;
  action?: string;
  field?: string;
  search?: string;
}) => {
  const {
    page = 1,
    limit = 10,
    orderId,
    staffId,
    action,
    field,
    search,
  } = filters;

  const skip = (page - 1) * limit;
  const filter: any = {};

  // Filter by order ID
  if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
    filter.order = new mongoose.Types.ObjectId(orderId);
  }

  // Filter by staff ID
  if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
    filter.admin = new mongoose.Types.ObjectId(staffId);
  }

  // Filter by action
  if (action && action !== "all") {
    filter.action = action;
  }

  // Filter by field
  if (field && field !== "all") {
    filter.field = field;
  }

  // Build aggregation pipeline for search
  const pipeline: any[] = [];

  // If search is provided, we need to use aggregation to search across populated fields
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    
    // First, lookup orders to search by orderNumber
    pipeline.push({
      $lookup: {
        from: "orders",
        localField: "order",
        foreignField: "_id",
        as: "orderDoc",
        pipeline: [
          { $project: { orderNumber: 1, status: 1, user: 1 } }
        ]
      }
    });
    
    // Lookup admin to search by name/email
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "admin",
        foreignField: "_id",
        as: "adminDoc",
        pipeline: [
          { $project: { name: 1, email: 1, role: 1 } }
        ]
      }
    });
    
    // Unwind the arrays
    pipeline.push({
      $unwind: { path: "$orderDoc", preserveNullAndEmptyArrays: true }
    });
    pipeline.push({
      $unwind: { path: "$adminDoc", preserveNullAndEmptyArrays: true }
    });
    
    // Add search match
    pipeline.push({
      $match: {
        $or: [
          { "orderDoc.orderNumber": { $regex: searchRegex } },
          { "adminDoc.name": { $regex: searchRegex } },
          { "adminDoc.email": { $regex: searchRegex } }
        ]
      }
    });
    
    // Apply other filters
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }
    
    // Sort and paginate
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    
    // Project to match expected structure
    pipeline.push({
      $project: {
        _id: 1,
        order: "$orderDoc._id",
        admin: "$adminDoc._id",
        action: 1,
        field: 1,
        oldValue: 1,
        newValue: 1,
        description: 1,
        metadata: 1,
        createdAt: 1,
        updatedAt: 1,
        orderDoc: 1,
        adminDoc: 1
      }
    });
    
    // Build count pipeline (without sort, skip, limit, and project)
    const countPipeline = [...pipeline];
    // Remove sort, skip, limit, and project stages
    const stagesToRemove = ['$sort', '$skip', '$limit', '$project'];
    const filteredCountPipeline = countPipeline.filter((stage: any) => {
      const stageKey = Object.keys(stage)[0];
      return !stagesToRemove.includes(stageKey);
    });
    filteredCountPipeline.push({ $count: "total" });
    
    // Get logs and total
    const [logsResult, totalResult] = await Promise.all([
      OrderLog.aggregate(pipeline),
      OrderLog.aggregate(filteredCountPipeline)
    ]);
    
    // Transform logs to match expected structure with populated fields
    const logs = logsResult.map((log: any) => ({
      _id: log._id,
      order: log.orderDoc ? {
        _id: log.orderDoc._id,
        status: log.orderDoc.status,
        orderNumber: log.orderDoc.orderNumber,
        user: log.orderDoc.user
      } : log.order,
      admin: log.adminDoc ? {
        _id: log.adminDoc._id,
        name: log.adminDoc.name,
        email: log.adminDoc.email,
        role: log.adminDoc.role
      } : log.admin,
      action: log.action,
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      description: log.description,
      metadata: log.metadata,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt
    }));
    
    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
    };
  }

  // No search - use simple find
  const [logs, total] = await Promise.all([
    OrderLog.find(filter)
      .populate("order", "status orderNumber user")
      .populate("admin", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OrderLog.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
  };
};

export const getAllAnalytics = async (days = 7, dailyDays = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dailyStartDate = new Date();
    dailyStartDate.setDate(dailyStartDate.getDate() - dailyDays);

    // Get all logs for the period (used for multiple analytics)
    const logs = await OrderLog.find({
      createdAt: { $gte: startDate }
    })
      .populate("admin", "name email role")
      .lean();

    // Staff Activity Analytics
    const staffActivity: Record<string, {
      name: string;
      email?: string;
      role: string;
      totalActions: number;
      views: number;
      statusUpdates: number;
      itemUpdates: number;
      listViews: number;
      lastActivity: string | null;
    }> = {};

    logs.forEach((log: any) => {
      if (!log.admin) return;
      
      const adminId = typeof log.admin === 'object' && log.admin?._id 
        ? log.admin._id.toString() 
        : log.admin;
      
      if (!adminId) return;
      
      const admin = typeof log.admin === 'object' ? log.admin : null;

      if (!staffActivity[adminId]) {
        staffActivity[adminId] = {
          name: admin?.name || 'Unknown',
          email: admin?.email,
          role: admin?.role || 'unknown',
          totalActions: 0,
          views: 0,
          statusUpdates: 0,
          itemUpdates: 0,
          listViews: 0,
          lastActivity: null,
        };
      }

      staffActivity[adminId].totalActions++;
      
      if (log.action === OrderLogAction.VIEW) {
        staffActivity[adminId].views++;
      } else if (log.action === OrderLogAction.UPDATE) {
        staffActivity[adminId].statusUpdates++;
      } else if (log.action === OrderLogAction.LIST) {
        staffActivity[adminId].listViews++;
      }

      if (log.createdAt) {
        const logDate = new Date(log.createdAt);
        if (!staffActivity[adminId].lastActivity || logDate > new Date(staffActivity[adminId].lastActivity || 0)) {
          staffActivity[adminId].lastActivity = logDate.toISOString();
        }
      }
    });

    // Action Breakdown
    const actionBreakdown = await OrderLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          uniqueAdmins: { $addToSet: "$admin" }
        }
      },
      {
        $project: {
          action: "$_id",
          count: 1,
          uniqueAdminsCount: { $size: "$uniqueAdmins" },
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Hourly Activity
    const hourlyCounts: Record<number, number> = {};
    
    logs.forEach((log: any) => {
      const hour = new Date(log.createdAt).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });

    const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyCounts[i] || 0
    }));

    // Daily Activity
    const dailyActivity = await OrderLog.aggregate([
      {
        $match: {
          createdAt: { $gte: dailyStartDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          views: {
            $sum: { $cond: [{ $eq: ["$action", "view"] }, 1, 0] }
          },
          updates: {
            $sum: { $cond: [{ $in: ["$action", ["status_update", "items_updated"]] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          views: 1,
          updates: 1,
          _id: 0
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    // Most Viewed Orders
    const mostViewedOrders = await OrderLog.aggregate([
      {
        $match: {
          action: "view",
          order: { $exists: true, $ne: null },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$order",
          viewCount: { $sum: 1 },
          uniqueViewers: { $addToSet: "$admin" },
          lastViewed: { $max: "$createdAt" }
        }
      },
      {
        $project: {
          orderId: "$_id",
          viewCount: 1,
          uniqueViewersCount: { $size: "$uniqueViewers" },
          lastViewed: 1,
          _id: 0
        }
      },
      {
        $sort: { viewCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return {
      staffActivity: Object.values(staffActivity).sort((a, b) => b.totalActions - a.totalActions),
      actionBreakdown,
      hourlyActivity,
      dailyActivity,
      mostViewedOrders,
    };
  } catch (error) {
    console.error("Error in getAllAnalytics:", error);
    throw error;
  }
};

