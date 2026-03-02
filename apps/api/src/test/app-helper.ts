import type { Express } from 'express';

let cachedApp: Express | undefined;

/**
 * Returns the Express app instance for supertest integration tests.
 * The app is created once per worker and cached — no HTTP port is bound (AC-4).
 */
export async function getTestApp(): Promise<Express> {
    if (cachedApp) return cachedApp;

    const { createApp } = await import('../app.js');
    cachedApp = await createApp({ redisClient: null });
    return cachedApp;
}
