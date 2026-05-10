import { Router } from 'express';
import { notionController } from './notion.controller.js';

export const notionRoutes = Router();

notionRoutes.post('/summarize', notionController.summarize);
