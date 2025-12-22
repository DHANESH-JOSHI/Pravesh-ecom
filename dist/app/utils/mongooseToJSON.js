"use strict";
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
exports.mongooseToJSONOptions = {
    virtuals: true,
    transform: defaultTransform,
};
exports.mongooseToObjectOptions = {
    virtuals: true,
    transform: defaultTransform,
};
function applyMongooseToJSON(schema) {
    if (!schema || typeof schema.set !== 'function') {
        throw new TypeError('applyMongooseToJSON expects a Mongoose Schema instance');
    }
    schema.set('toJSON', exports.mongooseToJSONOptions);
    schema.set('toObject', exports.mongooseToObjectOptions);
}
exports.default = applyMongooseToJSON;
//# sourceMappingURL=mongooseToJSON.js.map