import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
const PORT = Number(process.env['PORT']) || 4000;

function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env['CORS_ORIGINS'] ?? 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Content Pulse API running on port ${PORT}`);
});

export default app;
