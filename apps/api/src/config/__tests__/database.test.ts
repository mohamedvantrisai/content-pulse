/**
 * TC-3: Verify connect() with valid URI reaches connected state.
 * TC-4: Verify connect() with invalid URI retries 3 times then throws.
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Stub env and logger before importing database module
jest.mock('../env.js', () => ({
    env: {
        MONGODB_URI: 'placeholder', // overridden per test
        LOG_LEVEL: 'info',
        NODE_ENV: 'test',
    },
}));

jest.mock('../../lib/logger.js', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { env } from '../env.js';
import { connect, disconnect } from '../database.js';
import { logger } from '../../lib/logger.js';

describe('database', () => {
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
    });

    afterAll(async () => {
        await mongoServer.stop();
    });

    afterEach(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        jest.clearAllMocks();
    });

    it('TC-3: connects to MongoDB with valid URI', async () => {
        (env as { MONGODB_URI: string }).MONGODB_URI = mongoServer.getUri();

        await connect();

        expect(mongoose.connection.readyState).toBe(1);
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({ host: expect.any(String) }),
            'MongoDB connected',
        );
    });

    it('TC-3: disconnect() cleanly closes connection', async () => {
        (env as { MONGODB_URI: string }).MONGODB_URI = mongoServer.getUri();

        await connect();
        expect(mongoose.connection.readyState).toBe(1);

        await disconnect();
        expect(mongoose.connection.readyState).toBe(0);
        expect(logger.info).toHaveBeenCalledWith('MongoDB disconnected');
    });

    it('TC-4: retries 3 times then throws with invalid URI', async () => {
        (env as { MONGODB_URI: string }).MONGODB_URI =
            'mongodb://invalid-host:12345/fake?serverSelectionTimeoutMS=500';

        await expect(connect()).rejects.toThrow('MongoDB connection failed after 3 attempts');

        expect(logger.warn).toHaveBeenCalledTimes(2); // attempt 1/3 and 2/3
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.any(String) }),
            'MongoDB connection failed after 3 attempts',
        );
    }, 30000);
});
