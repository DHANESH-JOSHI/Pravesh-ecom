export class ApiResponse {
    statusCode: number;
    success: boolean;
    message: string;
    data?: any;
    constructor(statusCode: number, message: string, data?: any) {
        this.statusCode = statusCode;
        this.success = statusCode >= 200 && statusCode < 400;
        this.message = message;
        this.data = data;
    }
}