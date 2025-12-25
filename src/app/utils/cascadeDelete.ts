import mongoose from 'mongoose';

export interface CascadeOptions {
  session?: mongoose.ClientSession;
  skipValidation?: boolean;
}

export async function cascadeCategoryDelete(
  categoryId: mongoose.Types.ObjectId,
  options: CascadeOptions = {}
): Promise<void> {
  const { session } = options;
  const Category = mongoose.model('Category');
  const Product = mongoose.model('Product');
  const Brand = mongoose.model('Brand');

  await Category.updateMany(
    { parentCategory: categoryId, isDeleted: false },
    { $set: { isDeleted: true } },
    { session }
  );

  await Product.updateMany(
    { category: categoryId, isDeleted: false },
    { $unset: { category: '' } },
    { session }
  );

  await Brand.updateMany(
    { categories: categoryId, isDeleted: false },
    { $pull: { categories: categoryId } },
    { session }
  );
}

export async function cascadeBrandDelete(
  brandId: mongoose.Types.ObjectId,
  options: CascadeOptions = {}
): Promise<void> {
  const { session } = options;
  const Product = mongoose.model('Product');
  const Category = mongoose.model('Category');

  await Product.updateMany(
    { brand: brandId, isDeleted: false },
    { $unset: { brand: '' } },
    { session }
  );

  await Category.updateMany(
    { brands: brandId, isDeleted: false },
    { $pull: { brands: brandId } },
    { session }
  );
}

export async function cascadeProductDelete(
  productId: mongoose.Types.ObjectId,
  options: CascadeOptions = {}
): Promise<void> {
  const { session } = options;
  const Review = mongoose.model('Review');
  const Cart = mongoose.model('Cart');
  const Wishlist = mongoose.model('Wishlist');

  await Review.deleteMany(
    { product: productId },
    { session }
  );

  await Cart.updateMany(
    { 'items.product': productId },
    { $pull: { items: { product: productId } } },
    { session }
  );

  await Wishlist.updateMany(
    { items: productId },
    { $pull: { items: productId } },
    { session }
  );
}

export async function cascadeUserDelete(
  userId: mongoose.Types.ObjectId,
  options: CascadeOptions = {}
): Promise<void> {
  const { session } = options;
  const Review = mongoose.model('Review');
  const Address = mongoose.model('Address');
  const Cart = mongoose.model('Cart');
  const Wishlist = mongoose.model('Wishlist');

  await Review.deleteMany(
    { user: userId },
    { session }
  );

  await Address.updateMany(
    { user: userId, isDeleted: false },
    { $set: { isDeleted: true } },
    { session }
  );

  await Cart.deleteMany(
    { user: userId },
    { session }
  );

  await Wishlist.deleteMany(
    { user: userId },
    { session }
  );

}

export async function recalculateProductRating(
  productId: mongoose.Types.ObjectId,
  options: CascadeOptions = {}
): Promise<void> {
  const { session } = options;
  const Review = mongoose.model('Review');
  const Product = mongoose.model('Product');

  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        pipeline: [
          { $match: { isDeleted: false } },
          { $project: { _id: 1 } }
        ],
        as: 'productCheck'
      }
    },
    { $match: { productCheck: { $ne: [] } } },
    {
      $group: {
        _id: '$product',
        reviewCount: { $sum: 1 },
        rating: { $avg: '$rating' }
      }
    }
  ]).session(session || null);

  let reviewCount = 0;
  let rating = 0;

  if (stats.length > 0) {
    reviewCount = stats[0].reviewCount;
    rating = Math.round((stats[0].rating || 0) * 10) / 10;
  }

  await Product.findByIdAndUpdate(
    productId,
    { reviewCount, rating },
    { session }
  );
}

export function preventOrderDeletion(): never {
  throw new Error('Orders cannot be deleted. They are financial records and must be preserved for legal and accounting purposes.');
}

