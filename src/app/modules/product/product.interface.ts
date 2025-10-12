import { Document } from 'mongoose';

export enum UnitType {
  Bag = 'bag',
  Piece = 'piece',
  Kg = 'kg',
  Litre = 'litre',
  Box = 'box',
  Packet = 'packet',
  Set = 'set'
}

export enum DiscountType {
  Percentage = 'percentage',
  Fixed = 'fixed'
}

export enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  OutOfStock = 'out_of_stock',
  Discontinued = 'discontinued'
}

export interface IProduct extends Document {
  name: string;
  slug?: string;
  sku: string;
  description: string;
  shortDescription?: string;
  pricing: {
    basePrice: number;
    discount: {
      value: number;
      type: DiscountType;
    };
  };
  inventory: {
    stock: number;
    unit: UnitType;
    minStock: number;
  };
  category: string | object;
  brand?: string | object;
  images: string[];
  thumbnail: string;
  tags?: string[];
  features?: string[];
  specifications?: {
    [key: string]: string;
  };
  rating?: number;
  reviewCount?: number;
  status: ProductStatus;
  isFeatured: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  isDiscount: boolean;
  isWeeklyBestSelling: boolean;
  isWeeklyDiscount: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  shippingInfo?: {
    weight?: number;
    freeShipping?: boolean;
    shippingCost?: number;
    estimatedDelivery?: string;
  };
  isDeleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Virtuals
  finalPrice?: number;
  stockStatus?: string;
}

export interface IProductFilter {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  status?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  isDiscount?: boolean;
  isWeeklyBestSelling?: boolean;
  isWeeklyDiscount?: boolean;
  tags?: string[];
  features?: string[];
  rating?: number;
  search?: string;
}

export interface IProductQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: IProductFilter;
}
