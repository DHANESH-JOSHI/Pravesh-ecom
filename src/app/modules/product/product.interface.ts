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


export interface IProductUnit {
  unit: string; // e.g., "kg", "g", "piece", "packet"
  conversionRate: number; // conversion rate to base unit (e.g., 1 kg = 1000 g, so g has conversionRate 0.001)
  isBase?: boolean; // whether this is the base unit for calculations
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
  unit: string; // Base unit (required). Automatically synced with base unit in units array if present.
  units?: IProductUnit[]; // Array of available units with conversion rates. Base unit should have isBase=true and match the unit field.
  // stockStatus: StockStatus;
  specifications?: Record<string, any>;
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
