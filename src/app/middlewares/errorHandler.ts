import { Request, Response, NextFunction } from 'express';
import { handleCastError, handleDuplicateError, handleValidationError, handleZodError } from '@/errors';
import { ApiError, ApiResponse } from '@/interface';
import { ZodError } from 'zod';
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode || 500).json(new ApiResponse(err.statusCode || 500, err.message || 'Internal Server Error'))
    return;
  }
  if (err.name === 'CastError') err = handleCastError(err);
  if (err.code === 11000) err = handleDuplicateError(err);
  if (err.name === 'ValidationError') err = handleValidationError(err);
  if (err instanceof ZodError) err = handleZodError(err);

  res.status(err.statusCode).json({
    success: false,
    statusCode: err.statusCode || 500,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};