import { Schema, model } from 'mongoose';
import { IBlog } from './blog.interface';

const BlogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    content: { type: String, required: true },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    featuredImage: { type: String },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BlogSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title.toLowerCase().split(' ').join('-') + '-' + Date.now();
  }
  next();
});

export const Blog = model<IBlog>('Blog', BlogSchema);