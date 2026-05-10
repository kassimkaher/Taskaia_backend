import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { httpLogger } from './common/utils/logger.js';
import { errorMiddleware } from './common/middleware/error.middleware.js';
import { healthRoutes } from './health/health.routes.js';
import { settingsRoutes } from './settings/settings.routes.js';
import { recordRoutes } from './record/record.routes.js';
import { notionRoutes } from './notion/notion.routes.js';
import { trelloRoutes } from './trello/trello.routes.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGIN ?? '*'
      : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }));
  app.use(httpLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/health', healthRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/record', recordRoutes);
  app.use('/api/notion', notionRoutes);
  app.use('/api/trello', trelloRoutes);

  app.use(errorMiddleware);

  return app;
};
