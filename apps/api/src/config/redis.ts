import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export type RedisClient = Redis | null;

/**
 * Creates a Redis client from REDIS_URL.
 * Returns null if REDIS_URL is empty or connection fails (graceful degradation).
 */
export function createRedisClient(): RedisClient {
    if (!env.REDIS_URL) {
        logger.warn('REDIS_URL not set — Redis features disabled');
        return null;
    }

    const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    client.on('connect', () => {
        logger.info({ url: env.REDIS_URL }, 'Redis connected');
    });

    client.on('error', (error) => {
        logger.warn({ error: error.message }, 'Redis connection error');
    });

    client
        .connect()
        .catch(() => {
            logger.warn('Redis connection failed — features will be disabled');
        });

    return client;
}
