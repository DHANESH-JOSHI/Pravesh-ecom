import { Document, Schema } from 'mongoose';

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

export enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  OutOfStock = 'out_of_stock',
  Discontinued = 'discontinued'
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  description?: string;
  shortDescription?: string;

  category: Schema.Types.ObjectId;
  brand?: Schema.Types.ObjectId;

  pricing: {
    basePrice: number;
    discount?: {
      value: number;
      type: DiscountType;
    };
  };

  inventory: {
    stock: number;
    unit: UnitType;
    minStock?: number;
  };

  attributes: Record<string, any>;

  specifications?: Record<string, any>;

  images: string[];
  thumbnail: string;

  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];

  status?: ProductStatus;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  isDiscount?: boolean;
  isDeleted?: boolean;

  rating?: number;
  reviewCount?: number;

  shippingInfo?: {
    weight?: number; // kg or ton
    freeShipping?: boolean;
    shippingCost?: number;
    estimatedDelivery?: string;
  };

  createdAt?: Date;
  updatedAt?: Date;

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
  status?: ProductStatus;

  isFeatured?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  isDiscount?: boolean;
  isDeleted?: boolean;

  tags?: string[];
  attributes?: Record<string, any>;
  rating?: number;
  search?: string;
}

export interface IProductQuery {
  page?: number;
  limit?: number;
  sort?: string; // e.g.,
  order?: 'asc' | 'desc';
  filter?: IProductFilter;
}
