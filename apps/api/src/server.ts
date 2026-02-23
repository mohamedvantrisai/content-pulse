import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, logger, connectDatabase, createRedisClient } from './config/index.js';

function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

async function bootstrap(): Promise<void> {
  await connectDatabase();
  createRedisClient();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Content Pulse API started');
  });
}

bootstrap().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});

export default createApp;
