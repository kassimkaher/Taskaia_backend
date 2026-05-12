import './config/env.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';

const app = createApp();

const HOST = process.env.HOST ?? '127.0.0.1';

app.listen(env.PORT, HOST, () => {
  logger.info(`🚀 Taskaia backend running on http://${HOST}:${env.PORT}/api`);
  logger.info(`   MOCK_MODE: ${env.MOCK_MODE}`);
  logger.info(`   NODE_ENV:  ${env.NODE_ENV}`);
});
