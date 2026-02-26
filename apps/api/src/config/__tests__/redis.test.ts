/**
 * TC-5: Verify null export and warning log when REDIS_URL is empty.
 * TC-6: Verify client connects when REDIS_URL is valid.
 */

jest.mock('../../lib/logger.js', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { logger } from '../../lib/logger.js';

describe('redis', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    it('TC-5: returns null and logs warning when REDIS_URL is empty', async () => {
        jest.doMock('../env.js', () => ({
            env: { REDIS_URL: '', LOG_LEVEL: 'info', NODE_ENV: 'test' },
        }));

        const { createRedisClient } = await import('../redis.js');
        const client = createRedisClient();

        expect(client).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            'REDIS_URL not set — Redis features disabled',
        );
    });

    it('TC-6: connects successfully with valid REDIS_URL', async () => {
        jest.doMock('../env.js', () => ({
            env: { REDIS_URL: 'redis://localhost:6379', LOG_LEVEL: 'info', NODE_ENV: 'test' },
        }));

        const { createRedisClient } = await import('../redis.js');
        const client = createRedisClient();

        expect(client).not.toBeNull();

        // Wait for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (client) {
            expect(client.status).toBe('ready');
            await client.quit();
        }
    }, 10000);
});
