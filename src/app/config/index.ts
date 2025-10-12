import dotenv from 'dotenv';
import path from 'path';
import z from 'zod';

// Configure dotenv with quiet option to suppress all logs
dotenv.config({
    path: path.join(process.cwd(), '.env'),
    quiet: true // Suppress all dotenv logs
});

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string(
        {
            error: "DATABASE_URL is required"
        }
    ),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CLOUDINARY_CLOUD_NAME: z.string({
        error: "CLOUDINARY_CLOUD_NAME is required"
    }),
    CLOUDINARY_API_KEY: z.string({
        error: "CLOUDINARY_API_KEY is required"
    }),
    CLOUDINARY_API_SECRET: z.string({
        error: "CLOUDINARY_API_SECRET is required"
    }),
});

let envVars: z.infer<typeof envSchema>;
try {
    envVars = envSchema.parse(process.env);
    console.log("[ENV] Environment variables loaded.");
} catch (error) {
    if (error instanceof z.ZodError) {
        console.log("[ENV] Environment variable validation error:", error.issues.map(issue => issue.message).join(", "));
    } else {
        console.log("[ENV] Unexpected error during environment variable validation:", error);
    }
    process.exit(1);
}

export default envVars;