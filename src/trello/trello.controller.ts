import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { trelloService } from './trello.service.js';
import { success, apiError } from '../common/utils/response.js';

const createCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  recordingId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
  listId: z.string().optional(),
});

export const trelloController = {
  async createCard(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      }
      const { title, description, recordingId, labelIds, memberIds, listId } = parsed.data;
      const data = await trelloService.createCard(title, description, recordingId, labelIds, memberIds, listId);
      res.json(success(data, 'Task added to Trello successfully'));
    } catch (err) { next(err); }
  },

  async getCards(req: Request, res: Response, next: NextFunction) {
    try {
      const listId = typeof req.query['listId'] === 'string' ? req.query['listId'] : undefined;
      const cards = await trelloService.getCards(listId);
      res.json(success({ cards, total: cards.length }));
    } catch (err) { next(err); }
  },

  async getLists(req: Request, res: Response, next: NextFunction) {
    try {
      const lists = await trelloService.getLists();
      res.json(success({ lists }));
    } catch (err) { next(err); }
  },

  async getLabels(req: Request, res: Response, next: NextFunction) {
    try {
      const labels = await trelloService.getLabels();
      res.json(success({ labels }));
    } catch (err) { next(err); }
  },

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await trelloService.getMembers();
      res.json(success({ members }));
    } catch (err) { next(err); }
  },

  async getCardDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      const data = await trelloService.getCardDetail(cardId);
      res.json(success(data));
    } catch (err) { next(err); }
  },

  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      const data = await trelloService.addComment(cardId, parsed.data.text);
      res.json(success(data));
    } catch (err) { next(err); }
  },

  async moveCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      const parsed = z.object({ listId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      const data = await trelloService.moveCard(cardId, parsed.data.listId);
      res.json(success(data));
    } catch (err) { next(err); }
  },
};
