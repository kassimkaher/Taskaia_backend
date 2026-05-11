import { NextFunction, Request, Response } from 'express';
import { apiError, success } from '../common/utils/response.js';
import { updateSettingsSchema } from './settings.schema.js';
import { settingsService } from './settings.service.js';

export const settingsController = {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = settingsService.getSettings();
      res.json(success(data));
    } catch (err) { next(err); }
  },

  async saveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      }
      const data = await settingsService.saveSettings(parsed.data);
      res.json(success(data, 'Settings saved successfully'));
    } catch (err) { next(err); }
  },

  async getTrelloBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const boards = await settingsService.getTrelloBoards();
      res.json(success({ boards }));
    } catch (err) { next(err); }
  },

  async getTrelloLists(req: Request, res: Response, next: NextFunction) {
    try {
      const lists = await settingsService.getTrelloLists(req.params.boardId);
      res.json(success({ lists }));
    } catch (err) { next(err); }
  },
};
