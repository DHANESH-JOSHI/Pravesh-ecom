"use strict";
/**
 * Shared Mongoose toJSON / toObject helper
 *
 * Purpose:
 * - Provide a single, consistent `toJSON` transform and `toObject` option set
 *   for all models so we don't duplicate formatting logic.
 * - Remove the `id` virtual (to avoid duplicate of `_id`), remove `__v`,
 *   and format timestamps consistently.
 *
 * Usage (example in a model file):
 *   import { applyMongooseToJSON } from '../utils/mongooseToJSON';
 *   const schema = new mongoose.Schema(...);
 *   applyMongooseToJSON(schema);
 *
 * This will set:
 *   schema.set('toJSON', mongooseToJSONOptions);
 *   schema.set('toObject', mongooseToObjectOptions);
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongooseToObjectOptions = exports.mongooseToJSONOptions = void 0;
exports.applyMongooseToJSON = applyMongooseToJSON;
const formatTimestamp = (value) => {
    if (!value)
        return value;
    if (typeof value === 'string')
        return value;
    try {
        return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }
    catch {
        return value;
    }
};
const defaultTransform = (doc, ret) => {
    // Normalize timestamps to readable strings (India timezone)
    if (ret.createdAt && typeof ret.createdAt !== 'string') {
        ret.createdAt = formatTimestamp(ret.createdAt);
    }
    if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
        ret.updatedAt = formatTimestamp(ret.updatedAt);
    }
    // Remove Mongoose virtual `id` to avoid duplicating `_id` in API output.
    if (ret && Object.prototype.hasOwnProperty.call(ret, 'id')) {
        delete ret.id;
    }
    // Remove internal version key
    if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
        delete ret.__v;
    }
    return ret;
};
/**
 * Options object suitable for `schema.set('toJSON', ...)`
 */
exports.mongooseToJSONOptions = {
    virtuals: true,
    transform: defaultTransform,
};
/**
 * Options object suitable for `schema.set('toObject', ...)`
 */
exports.mongooseToObjectOptions = {
    virtuals: true,
    transform: defaultTransform,
};
/**
 * Convenience helper to apply the shared toJSON/toObject settings to a Schema
 */
function applyMongooseToJSON(schema) {
    if (!schema || typeof schema.set !== 'function') {
        throw new TypeError('applyMongooseToJSON expects a Mongoose Schema instance');
    }
    schema.set('toJSON', exports.mongooseToJSONOptions);
    schema.set('toObject', exports.mongooseToObjectOptions);
}
exports.default = applyMongooseToJSON;
//# sourceMappingURL=mongooseToJSON.js.map