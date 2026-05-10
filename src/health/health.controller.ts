import { Request, Response } from 'express';
import { success } from '../common/utils/response.js';

const VERSION = '1.0.0';

export const healthController = {
  check(_req: Request, res: Response) {
    res.json(success({
      ok: true,
      timestamp: new Date().toISOString(),
      version: VERSION,
    }));
  },
};
