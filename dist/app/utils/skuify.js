"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skuify = void 0;
const skuify = (text) => {
    if (!text)
        return `SKU${Date.now()}`;
    const cleaned = text
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    return cleaned.substring(0, 10) || `SKU${Date.now()}`;
};
exports.skuify = skuify;
//# sourceMappingURL=skuify.js.map