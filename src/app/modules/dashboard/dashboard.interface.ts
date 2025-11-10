export interface IDashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;

  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;

  todayRevenue: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  averageOrderValue: number;

  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;

  outOfStockProducts: number;
  lowStockProductsCount: number;
  newProductsThisMonth: number;

  recentOrders: Array<{
    _id: string;
    user: {
      name: string;
      email: string;
    };
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;

  topProducts: Array<{
    _id: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;

  topCategories: Array<{
    _id: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;

  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;

  orderStatusStats: {
    [key: string]: number;
  };

  // lowStockProducts: Array<{
  //   _id: string;
  //   name: string;
  //   // stock: number;
  // }>;

  // outOfStockList: Array<{
  //   _id: string;
  //   name: string;
  // }>;

  totalReviews: number;
  averageRating: number;
  totalWishlistItems: number;
  totalCartItems: number;

  totalBlogs: number;
  publishedBlogs: number;

  activeUsers: number;
}