import mongoose from 'mongoose';
import type Redis from 'ioredis';
import { logger } from '../lib/logger.js';

export interface HealthStatus {
    status: 'healthy' | 'degraded';
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'unavailable' | 'not configured';
    uptime: number;
    timestamp: string;
}

const DEFAULT_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_resolve, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ms),
        ),
    ]);
}

async function checkMongo(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<'connected' | 'disconnected'> {
    try {
        const db = mongoose.connection.db;
        if (!db || mongoose.connection.readyState !== 1) {
            return 'disconnected';
        }
        await withTimeout(db.admin().ping(), timeoutMs);
        return 'connected';
    } catch (error) {
        logger.warn(
            { error: error instanceof Error ? error.message : 'unknown' },
            'Health check: MongoDB ping failed',
        );
        return 'disconnected';
    }
}

async function checkRedis(
    client: Redis | null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<'connected' | 'unavailable' | 'not configured'> {
    if (!client) {
        return 'not configured';
    }

    try {
        await withTimeout(client.ping(), timeoutMs);
        return 'connected';
    } catch (error) {
        logger.warn(
            { error: error instanceof Error ? error.message : 'unknown' },
            'Health check: Redis ping failed',
        );
        return 'unavailable';
    }
}

export async function checkHealth(redisClient: Redis | null): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
        checkMongo(),
        checkRedis(redisClient),
    ]);

    const isDegraded = database === 'disconnected';

    return {
        status: isDegraded ? 'degraded' : 'healthy',
        database,
        redis,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };
}
