export class ApiError extends Error {
  statusCode: number;
  message: string;
  constructor(status: number, message = "") {
    super(message);
    this.statusCode = status;
    this.message = message;
    Error.captureStackTrace(this, this.constructor)
  }
}