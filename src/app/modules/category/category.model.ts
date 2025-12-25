import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from '@/utils/slugify';
import { getPixabayImageForCategory } from '@/utils/pixabay';
import { cascadeCategoryDelete } from '@/utils/cascadeDelete';
import { logger } from '@/config/logger';

const categorySchema: Schema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    image: {
      type: String,
    },
    brands: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    path: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(categorySchema);

categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  justOne: false,
  match: { isDeleted: false }
})

categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  justOne: false,
  match: { isDeleted: false }
})

categorySchema.index({ createdAt: -1 });
categorySchema.index({ parentCategory: -1 });
categorySchema.index({ isDeleted: -1 });
categorySchema.index(
  { parentCategory: 1, title: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);

categorySchema.pre("validate", async function (next) {
  if (this.isModified('title') || !this.slug) {
    if (this.title) {
      const excludeId = this._id ? String(this._id) : undefined;
      this.slug = await generateUniqueSlug(this.title as any, 'Category', excludeId);
    }
  }
  next();
});

categorySchema.pre("save", async function (next) {
  if (this.parentCategory) {
    const parent = await mongoose.model("Category").findById(this.parentCategory);
    if (parent) {
      this.path = [...parent.path, this.slug];
    }
  } else {
    this.path = [this.slug];
  }

  try {
    if (!this.image && this.title && Array.isArray(this.path)) {
      const pixabayUrl = await getPixabayImageForCategory(this.title as string, Array.isArray(this.path) ? this.path : []);
      if (pixabayUrl) {
        this.image = pixabayUrl;
      }
    }
  } catch (err: any) {
    logger.error('[CATEGORY_IMAGE] Generation failed:', err?.message || err);
  }

  next();
});

categorySchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const categoryId = query._id;
    const Category = mongoose.model("Category");
    
    const category = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (category) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeCategoryDelete(categoryId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  if (update?.title || update?.$set?.title) {
    const newTitle = update?.title || update?.$set?.title;
    if (newTitle) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newTitle, 'Category', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

categorySchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const categoryId = query._id;
    const Category = mongoose.model("Category");
    
    const category = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (category) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeCategoryDelete(categoryId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  if (update?.title || update?.$set?.title) {
    const newTitle = update?.title || update?.$set?.title;
    if (newTitle) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newTitle, 'Category', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

categorySchema.pre("updateMany", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const categories = await Category.find({ ...query, isDeleted: false });
    const session = this.getOptions().session;
    
    try {
      for (const category of categories) {
        await cascadeCategoryDelete(category._id as mongoose.Types.ObjectId, { session: session || undefined });
      }
    } catch (error: any) {
      return next(error);
    }
  }
  
  next();
});

export const Category: mongoose.Model<ICategory> =  mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);