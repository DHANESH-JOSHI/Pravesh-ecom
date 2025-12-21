"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = void 0;
exports.getTTL = getTTL;
exports.CacheTTL = {
    SHORT: 600, // 10 minutes
    MEDIUM: 900, // 15 minutes
    LONG: 1800, // 30 minutes
    XLONG: 3600, // 1 hour
};
function getTTL(key, fallback = exports.CacheTTL.SHORT) {
    return exports.CacheTTL[key] ?? fallback;
}
//# sourceMappingURL=cacheTTL.js.map