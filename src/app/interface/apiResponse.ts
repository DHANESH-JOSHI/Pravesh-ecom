import { logger } from "@/config/logger";
import status from "http-status";

export class ApiResponse {
  statusCode: number;
  success: boolean;
  message: string;
  data?: any;
  constructor(statusCode: number, message: string, data?: any, context = 'Global') {
    logger.info(`[${context}] : ${message}`);
    this.statusCode = statusCode;
    this.success = statusCode === status.OK || statusCode === status.CREATED || statusCode === status.ACCEPTED || statusCode === status.NO_CONTENT;
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