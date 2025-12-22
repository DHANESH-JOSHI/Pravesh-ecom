"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIndianMobile = void 0;
const indianMobileRegex = /^[6-9]\d{9}$/;
const validateIndianMobile = (phone) => {
    const cleanedPhone = phone.replace(/^(\+91|0)/, '').trim();
    if (!indianMobileRegex.test(cleanedPhone)) {
        throw new Error("Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9");
    }
    return cleanedPhone;
};
exports.validateIndianMobile = validateIndianMobile;
//# sourceMappingURL=validatePhone.js.map