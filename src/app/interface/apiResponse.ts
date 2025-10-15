import { logger } from "@/config/logger";

export class ApiResponse {
    statusCode: number;
    success: boolean;
    message: string;
    data?: any;
    constructor(statusCode: number, message: string, data?: any, context = 'Global') {
        logger.info(`[${context}] : ${message}`);
        this.statusCode = statusCode;
        this.success = statusCode >= 200 && statusCode < 400;
        this.message = message;
        this.data = data;
    }
}


export const getApiResponseClass = function (context: string) {
    return class extends ApiResponse {
        constructor(statusCode: number, message: string, data?: any) {
            super(statusCode, message, data, context);
        }
    };
}