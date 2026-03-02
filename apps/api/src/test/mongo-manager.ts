import mongoose from 'mongoose';

/**
 * Reusable helpers for tests that need explicit control over the
 * in-memory MongoDB connection managed by the global Jest setup.
 *
 * Most tests do NOT need to call these — the global setup.ts hooks
 * handle connect / clean / disconnect automatically.  Use these when
 * a test suite needs to override the default lifecycle (e.g. testing
 * the connect() function itself).
 */

/** Returns the MongoMemoryServer URI set by globalSetup. */
export function getMongoUri(): string {
    const uri = process.env['MONGO_MEMORY_URI'];
    if (!uri) {
        throw new Error('MONGO_MEMORY_URI is not set. Did globalSetup run?');
    }
    return uri;
}

/** Returns the current mongoose connection (throws if disconnected). */
export function getConnection(): mongoose.Connection {
    const conn = mongoose.connection;
    if (conn.readyState !== 1) {
        throw new Error(
            'Mongoose is not connected. Ensure setup.ts beforeAll has run.',
        );
    }
    return conn;
}

/** Deletes all documents from every collection in the current database. */
export async function clearDatabase(): Promise<void> {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
}

/** Disconnects mongoose from the in-memory server. */
export async function closeDatabase(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}
