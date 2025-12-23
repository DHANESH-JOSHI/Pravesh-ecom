import mongoose from "mongoose";
import slugify from "slugify";
import crypto from "crypto";

function generateRandomString(length: number = 6): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

export async function generateUniqueSlug(name: string, modelName?: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true, trim: true });
  
  const Model = modelName ? mongoose.model(modelName) : null;
  if (!Model) {
    return baseSlug;
  }

  const modelsWithUniqueNames = ['Brand', 'Category', 'Blog'];
  const isNameUnique = modelsWithUniqueNames.includes(modelName || '');

  if (isNameUnique) {
    return baseSlug;
  }

  const query: any = { slug: baseSlug, isDeleted: false };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await Model.findOne(query);
  
  if (!existing) {
    return baseSlug;
  }
  
  let uniqueSlug = baseSlug;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const randomStr = generateRandomString(6);
    uniqueSlug = `${baseSlug}-${randomStr}`;
    
    const checkQuery: any = { slug: uniqueSlug, isDeleted: false };
    if (excludeId) {
      checkQuery._id = { $ne: excludeId };
    }
    const duplicate = await Model.findOne(checkQuery);
    
    if (!duplicate) {
      return uniqueSlug;
    }
    
    attempts++;
  }

  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

