import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { apiError } from '../utils/response.js';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json(
        apiError('VALIDATION_ERROR', result.error.errors.map(e => e.message).join(', ')),
      );
    }
    req.body = result.data;
    next();
  };
