import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Jest globalTeardown — runs once after all workers finish.
 * Stops the shared MongoMemoryServer to release all handles (AC-10).
 */
export default async function globalTeardown(): Promise<void> {
    const mongod = (globalThis as Record<string, unknown>).__MONGOD__ as
        | MongoMemoryServer
        | undefined;

    if (mongod) {
        await mongod.stop({ doCleanup: true });
    }
}
