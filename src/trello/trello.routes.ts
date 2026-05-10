import { Router } from 'express';
import { trelloController } from './trello.controller.js';

export const trelloRoutes = Router();

trelloRoutes.post('/card', trelloController.createCard);
trelloRoutes.get('/cards', trelloController.getCards);
trelloRoutes.get('/lists', trelloController.getLists);
trelloRoutes.get('/labels', trelloController.getLabels);
trelloRoutes.get('/members', trelloController.getMembers);
trelloRoutes.get('/cards/:cardId', trelloController.getCardDetail);
trelloRoutes.post('/cards/:cardId/comments', trelloController.addComment);
trelloRoutes.put('/cards/:cardId/move', trelloController.moveCard);
