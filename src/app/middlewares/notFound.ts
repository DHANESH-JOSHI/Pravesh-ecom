import { ApiError } from '@/interface';
import { Request, Response, NextFunction } from 'express';
import status from 'http-status';
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const err = new ApiError(status.NOT_FOUND, 'Route Not Found');
  next(err);
};
