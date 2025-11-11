import { Schema } from 'mongoose';

type TransformFunction = (doc: any, ret: any, options?: any) => any;

const formatTimestamp = (value: any) => {
  if (!value) return value;
  if (typeof value === 'string') return value;
  try {
    return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return value;
  }
};

const defaultTransform: TransformFunction = (doc, ret) => {
  if (ret.createdAt && typeof ret.createdAt !== 'string') {
    ret.createdAt = formatTimestamp(ret.createdAt);
  }
  if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
    ret.updatedAt = formatTimestamp(ret.updatedAt);
  }

  if (ret && Object.prototype.hasOwnProperty.call(ret, 'id')) {
    delete ret.id;
  }

  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }

  return ret;
};

export const mongooseToJSONOptions = {
  virtuals: true,
  transform: defaultTransform as TransformFunction,
};

export const mongooseToObjectOptions = {
  virtuals: true,
  transform: defaultTransform as TransformFunction,
};

export function applyMongooseToJSON(schema: Schema) {
  if (!schema || typeof schema.set !== 'function') {
    throw new TypeError('applyMongooseToJSON expects a Mongoose Schema instance');
  }
  schema.set('toJSON', mongooseToJSONOptions);
  schema.set('toObject', mongooseToObjectOptions);
}

export default applyMongooseToJSON;