import mongoose from 'mongoose';

/**
 * Jest setupFilesAfterEnv — runs in each worker after the test framework
 * is initialised but before test files execute.
 *
 * Strategy:
 *  - Connect mongoose to the in-memory server using a worker-specific
 *    database name so parallel workers never collide (AC-3).
 *  - afterEach: drop all documents from every collection.
 *  - afterAll:  disconnect mongoose to avoid open-handle warnings (AC-10).
 */

const workerId = process.env['JEST_WORKER_ID'] ?? '1';

beforeAll(async () => {
    const baseUri = process.env['MONGO_MEMORY_URI'];
    if (!baseUri) {
        throw new Error(
            'MONGO_MEMORY_URI is not set. Did globalSetup run?',
        );
    }

    const dbName = `test_worker_${workerId}`;
    const uri = baseUri.endsWith('/')
        ? `${baseUri}${dbName}`
        : `${baseUri}/${dbName}`;

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
});

afterEach(async () => {
    if (mongoose.connection.readyState !== 1) return;

    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
});
