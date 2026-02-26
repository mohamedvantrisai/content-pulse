import { env, connectDatabase, createRedisClient } from './config/index.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const redis = createRedisClient();

  const app = await createApp({
    redisStatus: () => (redis ? redis.status : 'not configured'),
  });

  app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, address: `http://localhost:${env.PORT}` },
      `Server listening on port ${env.PORT}`,
    );
  });
}

bootstrap().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
