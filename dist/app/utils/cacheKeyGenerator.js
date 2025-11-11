"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCacheKey = void 0;
const generateCacheKey = (prefix, query) => {
    const sortedKeys = Object.keys(query).sort().map((key) => {
        const val = query[key];
        if (val === undefined || val === null)
            return '';
        if (Array.isArray(val))
            return `${key}=${val.map(v => `${v}`).join(',')}`;
        return `${key}=${query[key]}`;
    }).join('&');
    if (sortedKeys.length === 0)
        return prefix;
    return `${prefix}?${sortedKeys}`;
};
exports.generateCacheKey = generateCacheKey;
//# sourceMappingURL=cacheKeyGenerator.js.map