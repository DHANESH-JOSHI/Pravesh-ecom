"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./app/routes"));
const middlewares_1 = require("./app/middlewares");
const http_status_1 = __importDefault(require("http-status"));
const app = (0, express_1.default)();
// Trust proxy for Vercel/reverse proxy environments
app.set('trust proxy', 1);
const corsOptions = {
    origin: true,
    credentials: true,
    optionsSuccessStatus: http_status_1.default.OK
};
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)(corsOptions));
app.use((0, morgan_1.default)('dev'));
app.use('/api/v1', middlewares_1.apiLimiter, routes_1.default);
const entryRoute = (req, res) => {
    const message = 'Server is running...';
    res.send(message);
};
app.get('/', entryRoute);
app.use(middlewares_1.notFound);
app.use(middlewares_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map