import { ApiError } from '@/interface';
import { Request, Response, NextFunction } from 'express';
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const err = new ApiError(404, 'Route Not Found');
  next(err);
};
