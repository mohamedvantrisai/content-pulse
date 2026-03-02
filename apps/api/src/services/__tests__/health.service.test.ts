import type Redis from 'ioredis';
import mongoose from 'mongoose';
import { checkHealth, type HealthStatus } from '../health.service.js';

jest.mock('../../lib/logger.js', () => ({
    logger: {
        fatal: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    },
}));

const origReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const origDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');

function restoreMongoProps(): void {
    if (origReadyState) {
        Object.defineProperty(mongoose.connection, 'readyState', origReadyState);
    } else {
        delete (mongoose.connection as unknown as Record<string, unknown>)['readyState'];
    }
    if (origDb) {
        Object.defineProperty(mongoose.connection, 'db', origDb);
    } else {
        delete (mongoose.connection as unknown as Record<string, unknown>)['db'];
    }
}

function mockMongoConnected(): void {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true, writable: true });
    Object.defineProperty(mongoose.connection, 'db', {
        value: { admin: () => ({ ping: () => Promise.resolve({ ok: 1 }) }) },
        configurable: true,
        writable: true,
    });
}

function mockMongoDisconnected(): void {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true, writable: true });
    Object.defineProperty(mongoose.connection, 'db', { value: null, configurable: true, writable: true });
}

function createMockRedis(overrides?: Partial<Redis>): Redis {
    return { ping: jest.fn().mockResolvedValue('PONG'), ...overrides } as unknown as Redis;
}

describe('Health Service', () => {
    afterEach(() => {
        restoreMongoProps();
        jest.restoreAllMocks();
    });

    it('TC-1: returns healthy when all dependencies are connected', async () => {
        mockMongoConnected();
        const redis = createMockRedis();

        const result: HealthStatus = await checkHealth(redis);

        expect(result.status).toBe('healthy');
        expect(result.database).toBe('connected');
        expect(result.redis).toBe('connected');
        expect(typeof result.uptime).toBe('number');
        expect(typeof result.timestamp).toBe('string');
    });

    it('TC-2: returns degraded when MongoDB is down', async () => {
        mockMongoDisconnected();
        const redis = createMockRedis();

        const result = await checkHealth(redis);

        expect(result.status).toBe('degraded');
        expect(result.database).toBe('disconnected');
        expect(result.redis).toBe('connected');
    });

    it('TC-3: returns healthy when Redis is down', async () => {
        mockMongoConnected();
        const redis = createMockRedis({
            ping: jest.fn().mockRejectedValue(new Error('Connection refused')) as unknown as Redis['ping'],
        });

        const result = await checkHealth(redis);

        expect(result.status).toBe('healthy');
        expect(result.database).toBe('connected');
        expect(result.redis).toBe('unavailable');
    });

    it('TC-5: uptime is a positive number', async () => {
        mockMongoConnected();
        const redis = createMockRedis();

        const result = await checkHealth(redis);

        expect(result.uptime).toBeGreaterThan(0);
    });

    it('returns "not configured" when Redis client is null', async () => {
        mockMongoConnected();

        const result = await checkHealth(null);

        expect(result.status).toBe('healthy');
        expect(result.redis).toBe('not configured');
    });

    it('returns degraded when Mongo ping times out', async () => {
        Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true, writable: true });
        Object.defineProperty(mongoose.connection, 'db', {
            value: {
                admin: () => ({
                    ping: () => new Promise(() => { /* never resolves */ }),
                }),
            },
            configurable: true,
            writable: true,
        });

        const result = await checkHealth(null);

        expect(result.status).toBe('degraded');
        expect(result.database).toBe('disconnected');
    });

    it('returns unavailable when Redis ping times out', async () => {
        mockMongoConnected();
        const redis = createMockRedis({
            ping: jest.fn().mockImplementation(
                () => new Promise(() => { /* never resolves */ }),
            ) as unknown as Redis['ping'],
        });

        const result = await checkHealth(redis);

        expect(result.redis).toBe('unavailable');
    });

    it('never leaks error details in the response', async () => {
        mockMongoDisconnected();
        const redis = createMockRedis({
            ping: jest.fn().mockRejectedValue(
                new Error('redis://secret:password@host:6379'),
            ) as unknown as Redis['ping'],
        });

        const result = await checkHealth(redis);

        const json = JSON.stringify(result);
        expect(json).not.toContain('secret');
        expect(json).not.toContain('password');
        expect(json).not.toContain('stack');
    });
});
