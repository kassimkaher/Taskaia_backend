import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { validate } from '../common/middleware/validate.middleware.js';
import { updateSettingsSchema } from './settings.schema.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', settingsController.getSettings);
settingsRoutes.put('/', validate(updateSettingsSchema), settingsController.saveSettings);
settingsRoutes.get('/trello/boards', settingsController.getTrelloBoards);
settingsRoutes.get('/trello/lists/:boardId', settingsController.getTrelloLists);
