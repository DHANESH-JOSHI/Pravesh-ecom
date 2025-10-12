import { Request, Response, NextFunction } from 'express';
import { handleCastError, handleDuplicateError, handleValidationError, handleZodError } from '@/errors';
import { ApiError, ApiResponse } from '@/interface';
import { ZodError } from 'zod';
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  if (err instanceof ApiError) {
    res.status(statusCode).json(new ApiResponse(statusCode, message))
    return;
  }
  if (err.name === 'CastError') err = handleCastError(err);
  if (err.code === 11000) err = handleDuplicateError(err);
  if (err.name === 'ValidationError') err = handleValidationError(err);
  if (err instanceof ZodError) err = handleZodError(err);

  res.status(err.statusCode).json({
    success: false,
    statusCode,
    message,
    errorMessages: err.errors || [{ path: '', message: err.message }],
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};