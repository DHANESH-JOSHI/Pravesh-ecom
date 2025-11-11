"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockStatus = exports.DiscountType = exports.UnitType = void 0;
var UnitType;
(function (UnitType) {
    UnitType["Bag"] = "bag";
    UnitType["Piece"] = "piece";
    UnitType["Kg"] = "kg";
    UnitType["Tonne"] = "tonne";
    UnitType["Litre"] = "litre";
    UnitType["Box"] = "box";
    UnitType["Packet"] = "packet";
    UnitType["Set"] = "set";
    UnitType["Bundle"] = "bundle";
    UnitType["Meter"] = "meter";
})(UnitType || (exports.UnitType = UnitType = {}));
var DiscountType;
(function (DiscountType) {
    DiscountType["Percentage"] = "percentage";
    DiscountType["Fixed"] = "fixed";
})(DiscountType || (exports.DiscountType = DiscountType = {}));
var StockStatus;
(function (StockStatus) {
    StockStatus["InStock"] = "in_stock";
    StockStatus["LowStock"] = "low_stock";
    StockStatus["OutOfStock"] = "out_of_stock";
})(StockStatus || (exports.StockStatus = StockStatus = {}));
//# sourceMappingURL=product.interface.js.map