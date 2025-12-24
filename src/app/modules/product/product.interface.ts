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


export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  // description?: string;
  // shortDescription?: string;

  category: Types.ObjectId;
  brand?: Types.ObjectId;


  // stock: number;
  // minStock: number;
  units: Types.ObjectId[]; // Array of unit IDs. At least one unit required. Users can select any unit when purchasing.
  // stockStatus: StockStatus;
  variants?: Record<string, string[]>; // User-selectable variants (e.g., { size: ["S", "M", "L"], color: ["Red", "Blue"] })
  specifications?: Record<string, string | string[]>; // Technical specifications (e.g., { strength: "50kg", diameter: "10cm" })
  // features?: string[];
  // images: string[];
  thumbnail?: string;

  tags?: string[];

  isFeatured?: boolean;
  isNewArrival?: boolean;
  // isDiscount?: boolean;
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
  // inStock?: boolean;
  // stockStatus?: StockStatus;

  isFeatured?: boolean;
  isNewArrival?: boolean;
  // isDiscount?: boolean;
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
