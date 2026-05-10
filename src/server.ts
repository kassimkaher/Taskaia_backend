import './config/env.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';

const app = createApp();

app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`🚀 Taskaia backend running on http://0.0.0.0:${env.PORT}/api`);
  logger.info(`   MOCK_MODE: ${env.MOCK_MODE}`);
  logger.info(`   NODE_ENV:  ${env.NODE_ENV}`);
});
