"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const slugify_1 = require("../../utils/slugify");
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const blogSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    content: { type: String, required: true },
    featuredImage: { type: String },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(blogSchema);
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
const reserveSlugAtomic = async (baseName) => {
    const base = ((0, slugify_1.slugify)(baseName || '') || String(Date.now())).toString();
    const coll = mongoose_1.default.connection.collection('slug_counters');
    // Atomically increment sequence for this base slug
    const res = await coll.findOneAndUpdate({ _id: base }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
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
    const tasks = [];
    // If no slug provided by user, derive from title and reserve atomically.
    if (!this.slug && this.title) {
        const base = (0, slugify_1.slugify)(this.title);
        const p = reserveSlugAtomic(base).then((slug) => {
            this.slug = slug;
        });
        tasks.push(p);
    }
    else if (this.slug) {
        // If user provided a slug, normalize it and attempt to reserve it atomically to avoid collisions.
        const baseProvided = (0, slugify_1.slugify)(this.slug);
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
exports.Blog = (0, mongoose_1.model)('Blog', blogSchema);
//# sourceMappingURL=blog.model.js.map