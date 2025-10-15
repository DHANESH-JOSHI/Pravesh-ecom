export class ApiError extends Error {
  statusCode: number;
  message: string;
  context?: string;
  constructor(status: number, message = "", context: string = "Global") {
    super(message);
    this.statusCode = status;
    this.message = message;
    this.context = context;
    Error.captureStackTrace(this, this.constructor)
  }
}


export const getApiErrorClass = function (context: string) {
  return class extends ApiError {
    constructor(status: number, message = "") {
      super(status, message, context);
    }
  }
}