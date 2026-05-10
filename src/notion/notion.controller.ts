import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { notionService } from './notion.service.js';
import { success, apiError } from '../common/utils/response.js';

const labelSchema = z.object({ id: z.string(), name: z.string(), color: z.string() });
const memberSchema = z.object({ id: z.string(), fullName: z.string(), username: z.string() });

const summarizeSchema = z.object({
  recordingId: z.string().min(1),
  rawText: z.string().min(1),
  labels: z.array(labelSchema).optional().default([]),
  members: z.array(memberSchema).optional().default([]),
});

export const notionController = {
  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = summarizeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json(apiError('VALIDATION_ERROR', parsed.error.message));
      }
      const { recordingId, rawText, labels, members } = parsed.data;
      const data = await notionService.summarize(recordingId, rawText, labels, members);
      res.json(success(data));
    } catch (err) { next(err); }
  },
};
