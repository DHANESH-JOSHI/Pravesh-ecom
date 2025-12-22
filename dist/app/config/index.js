"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = __importDefault(require("zod"));
dotenv_1.default.config({
    path: path_1.default.join(process.cwd(), ".env"),
    quiet: true,
});
const envSchema = zod_1.default.object({
    PORT: zod_1.default.coerce.number().default(3000),
    DATABASE_URL: zod_1.default.string({
        error: "DATABASE_URL is required",
    }),
    NODE_ENV: zod_1.default
        .enum(["development", "production", "test"])
        .default("development"),
    CLOUDINARY_CLOUD_NAME: zod_1.default.string({
        error: "CLOUDINARY_CLOUD_NAME is required",
    }),
    CLOUDINARY_API_KEY: zod_1.default.string({
        error: "CLOUDINARY_API_KEY is required",
    }),
    CLOUDINARY_API_SECRET: zod_1.default.string({
        error: "CLOUDINARY_API_SECRET is required",
    }),
    JWT_SECRET: zod_1.default.string({
        error: "JWT_SECRET is required",
    }),
    SMS_SENDER_ID: zod_1.default.string({
        error: "SMS_SENDER_ID is required",
    }),
    SMS_AUTH_KEY: zod_1.default.string({
        error: "SMS_AUTH_KEY is required",
    }),
    RESEND_API_KEY: zod_1.default.string({
        error: "RESEND_API_KEY is required",
    }),
    RESEND_DOMAIN: zod_1.default.string({
        error: "RESEND_DOMAIN is required",
    }),
    REDIS_URL: zod_1.default.string({
        error: "REDIS_URL is required",
    }),
    PIXABAY_API_KEY: zod_1.default.string({
        error: "PIXABAY_API_KEY is required",
    }),
});
let envVars;
try {
    envVars = envSchema.parse(process.env);
    console.info("[ENV] Environment variables loaded.");
}
catch (error) {
    if (error instanceof zod_1.default.ZodError) {
        console.error("[ENV] Environment variable validation error:", error.issues.map((issue) => issue.message).join(", "));
    }
    else {
        console.error("[ENV] Unexpected error during environment variable validation:", error);
    }
    process.exit(1);
}
exports.default = envVars;
//# sourceMappingURL=index.js.map