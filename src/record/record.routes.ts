import { Router } from 'express';
import { recordController } from './record.controller.js';
import { uploadAudio } from './upload.middleware.js';

export const recordRoutes = Router();

recordRoutes.post('/upload', uploadAudio, recordController.upload);
recordRoutes.get('/', recordController.list);
