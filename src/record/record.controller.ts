import { Request, Response, NextFunction } from 'express';
import { recordService } from './record.service.js';
import { success } from '../common/utils/response.js';
import { AppError } from '../common/types/app-error.js';

export const recordController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('MISSING_AUDIO', 'Audio file is required', 422);
      }
      const data = await recordService.upload(req.file.path, req.file.originalname);
      res.json(success(data));
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const recordings = await recordService.list();
      res.json(success({ recordings }));
    } catch (err) { next(err); }
  },
};
