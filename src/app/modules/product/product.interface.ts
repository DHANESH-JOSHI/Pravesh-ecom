import { Document, Types } from 'mongoose';

export enum UnitType {
  Bag = 'bag',
  Piece = 'piece',
  Kg = 'kg',
  Tonne = 'tonne',
  Litre = 'litre',
  Box = 'box',
  Packet = 'packet',
  Set = 'set',
  Bundle = 'bundle',
  Meter = 'meter'
}

export enum DiscountType {
  Percentage = 'percentage',
  Fixed = 'fixed'
}

export enum StockStatus {
  InStock = 'in_stock',
  LowStock = 'low_stock',
  OutOfStock = 'out_of_stock',
}

export enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  Discontinued = 'discontinued'
}


export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  description?: string;
  shortDescription?: string;

  category: Types.ObjectId;
  brand?: Types.ObjectId;

  originalPrice: number;
  discountValue: number;
  discountType: DiscountType;
  finalPrice: number;

  stock: number;
  minStock: number;
  unit: UnitType;
  stockStatus: StockStatus;
  specifications?: Record<string, any>;
  features?: string[];
  images: string[];
  thumbnail: string;

  status: ProductStatus;
  tags?: string[];

  isFeatured?: boolean;
  isNewArrival?: boolean;
  isDiscount?: boolean;
  isDeleted?: boolean;

  rating?: number;
  reviewCount?: number;

  totalSold?: number;
  salesCount?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProductFilter {
  categoryId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  stockStatus?: StockStatus;
  status?: ProductStatus;

  isFeatured?: boolean;
  isNewArrival?: boolean;
  isDiscount?: boolean;
  isDeleted?: boolean;

  tags?: string[];
  rating?: number;
  search?: string;
}

export interface IProductQuery extends IProductFilter {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
