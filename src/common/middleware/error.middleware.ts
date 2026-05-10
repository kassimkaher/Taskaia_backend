import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/app-error.js';
import { apiError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(apiError(err.code, err.message));
  }
  logger.error(err);
  res.status(500).json(apiError('INTERNAL_ERROR', 'An unexpected error occurred'));
};
