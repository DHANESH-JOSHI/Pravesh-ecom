export interface IDashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;

  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;

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
    status: string;
    createdAt: string;
  }>;

  topProducts: Array<{
    _id: string;
    name: string;
    totalSold: number;
    salesCount: number;
    reviewCount: number;
    rating: number;
  }>;

  trendingProducts: Array<{
    _id: string;
    name: string;
    salesCount: number;
    totalSold: number;
    reviewCount: number;
    rating: number;
  }>;

  topCategories: Array<{
    _id: string;
    name: string;
    totalSold: number;
  }>;

  monthlyOrders: Array<{
    month: string;
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