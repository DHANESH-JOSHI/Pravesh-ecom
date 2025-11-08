import mongoose, { Schema, model } from 'mongoose';
import { IBlog } from './blog.interface';
import { slugify } from '@/utils/slugify';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const blogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    content: { type: String, required: true },
    featuredImage: { type: String },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(blogSchema);

blogSchema.index({ isPublished: 1, isDeleted: 1, createdAt: -1 });
blogSchema.index({ title: 'text', content: 'text' });
blogSchema.index({ slug: 1, isDeleted: 1 });

/**
 * Reserve a unique slug atomically using a per-base counter.
 *
 * Behavior:
 * - Uses a 'slug_counters' collection; each document _id is the base slug.
 * - findOneAndUpdate with $inc is atomic: first reservation yields seq=1 -> use base.
 *   subsequent reservations yield seq=2 -> base-1, seq=3 -> base-2, etc.
 *
 * This guarantees no two creations receive the same slug even under concurrency.
 */
const reserveSlugAtomic = async (baseName: string) => {
  const base = (slugify(baseName || '') || String(Date.now())).toString();
  const coll = mongoose.connection.collection('slug_counters');
  // Atomically increment sequence for this base slug
  const res = await coll.findOneAndUpdate(
    { _id: base } as any,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = res?.value && typeof res?.value.seq === 'number' ? res.value.seq : 1;
  if (seq === 1) {
    return base;
  }
  // seq=2 => base-1, seq=3 => base-2, ...
  return `${base}-${seq - 1}`;
};

blogSchema.pre('save', function (next) {
  // Only generate/normalize slug on creation
  if (!this.isNew) {
    // If title was changed and no slug exists, we keep existing slug (do not overwrite)
    return next();
  }

  const tasks: Promise<void>[] = [];

  // If no slug provided by user, derive from title and reserve atomically.
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    const p = reserveSlugAtomic(base).then((slug) => {
      this.slug = slug;
    });
    tasks.push(p);
  } else if (this.slug) {
    // If user provided a slug, normalize it and attempt to reserve it atomically to avoid collisions.
    const baseProvided = slugify(this.slug);
    const p = reserveSlugAtomic(baseProvided).then((reserved) => {
      this.slug = reserved;
    });
    tasks.push(p);
  }

  if (tasks.length === 0) {
    return next();
  }

  Promise.all(tasks)
    .then(() => next())
    .catch((err) => next(err));
});

export const Blog = model<IBlog>('Blog', blogSchema);