import { Request, Response, NextFunction } from 'express';
import { handleCastError, handleDuplicateError, handleZodError } from '@/errors';
import { ApiResponse } from '@/interface';
import { ZodError } from 'zod';
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'CastError') err = handleCastError(err);
  if (err.code === 11000) err = handleDuplicateError(err);
  if (err instanceof ZodError) err = handleZodError(err);
  res.status(err.statusCode || 500).json(new ApiResponse(err.statusCode || 500, err.message || 'Internal Server Error', undefined, err.context))
  return;
};