import { OrderLog } from "./order-log.model";
import { Types } from "mongoose";

interface LogOrderChangeParams {
  orderId?: string | Types.ObjectId; // Optional for list views
  adminId: string | Types.ObjectId;
  action: string;
  field?: string;
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

export const getOrderLogs = async (orderId: string | Types.ObjectId, limit = 50) => {
  return await OrderLog.find({ order: orderId })
    .populate("admin", "name email role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const getRecentLogs = async (limit = 50, skip = 0) => {
  const logs = await OrderLog.find()
    .populate("order", "status user")
    .populate("admin", "name email role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const total = await OrderLog.countDocuments();
  
  return {
    logs,
    hasMore: skip + logs.length < total,
    total,
  };
};

export const getLogsByStaffId = async (staffId: string | Types.ObjectId, limit = 50, skip = 0) => {
  const logs = await OrderLog.find({ admin: staffId })
    .populate("order", "status user")
    .populate("admin", "name email role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const total = await OrderLog.countDocuments({ admin: staffId });
  
  return {
    logs,
    hasMore: skip + logs.length < total,
    total,
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
      
      if (log.action === 'view') {
        staffActivity[adminId].views++;
      } else if (log.action === 'status_update') {
        staffActivity[adminId].statusUpdates++;
      } else if (log.action === 'items_updated') {
        staffActivity[adminId].itemUpdates++;
      } else if (log.action === 'view_list') {
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

export const getUserLogAnalytics = async (staffId: string | Types.ObjectId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const adminId = typeof staffId === 'string' ? new Types.ObjectId(staffId) : staffId;

    // Get total logs count
    const totalLogs = await OrderLog.countDocuments({
      admin: adminId,
      createdAt: { $gte: startDate }
    });

    // Get action breakdown
    const actionBreakdown = await OrderLog.aggregate([
      {
        $match: {
          admin: adminId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          action: "$_id",
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get daily activity
    const dailyActivity = await OrderLog.aggregate([
      {
        $match: {
          admin: adminId,
          createdAt: { $gte: startDate }
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
            $sum: { $cond: [{ $in: ["$action", ["status_update", "items_updated", "feedback_updated"]] }, 1, 0] }
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

    // Get hourly activity
    const hourlyActivity = await OrderLog.aggregate([
      {
        $match: {
          admin: adminId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          hour: "$_id",
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);

    // Fill missing hours
    const fullHourlyData = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyActivity.find((h: any) => h.hour === i);
      return {
        hour: i,
        count: hourData?.count || 0
      };
    });

    // Get most viewed orders
    const mostViewedOrders = await OrderLog.aggregate([
      {
        $match: {
          admin: adminId,
          action: "view",
          order: { $exists: true, $ne: null },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$order",
          viewCount: { $sum: 1 },
          lastViewed: { $max: "$createdAt" }
        }
      },
      {
        $project: {
          orderId: "$_id",
          viewCount: 1,
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

    // Get summary stats
    const summary = {
      totalActions: totalLogs,
      views: actionBreakdown.find((a: any) => a.action === 'view')?.count || 0,
      statusUpdates: actionBreakdown.find((a: any) => a.action === 'status_update')?.count || 0,
      itemUpdates: actionBreakdown.find((a: any) => a.action === 'items_updated')?.count || 0,
      feedbackUpdates: actionBreakdown.find((a: any) => a.action === 'feedback_updated')?.count || 0,
      listViews: actionBreakdown.find((a: any) => a.action === 'view_list')?.count || 0,
    };

    return {
      summary,
      actionBreakdown,
      dailyActivity,
      hourlyActivity: fullHourlyData,
      mostViewedOrders,
      period: days
    };
  } catch (error) {
    console.error("Error in getUserLogAnalytics:", error);
    throw error;
  }
};
