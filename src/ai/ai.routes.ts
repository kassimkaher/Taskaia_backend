import { Router } from 'express';
import { aiController } from './ai.controller.js';

export const aiRoutes = Router();

aiRoutes.post('/extract', aiController.extract);
