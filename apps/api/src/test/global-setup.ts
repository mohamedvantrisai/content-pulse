import { MongoMemoryServer } from 'mongodb-memory-server';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

/**
 * Jest globalSetup — runs once in the parent process before any workers spawn.
 *
 * Responsibilities:
 *  1. Start a single MongoMemoryServer instance (shared across workers).
 *  2. Export the URI via process.env so workers inherit it.
 *  3. Set test-safe env defaults so Zod validation in env.ts passes
 *     without requiring a real .env file.
 *  4. Optionally load .env.test if present.
 */
export default async function globalSetup(): Promise<void> {
    const envTestPath = resolve(process.cwd(), '.env.test');
    if (existsSync(envTestPath)) {
        dotenv.config({ path: envTestPath });
    }

    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    (globalThis as Record<string, unknown>).__MONGOD__ = mongod;

    process.env['MONGO_MEMORY_URI'] = uri;
    process.env['MONGODB_URI'] = uri;
    process.env['NODE_ENV'] = 'test';
    process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long';
    process.env['ENCRYPTION_KEY'] =
        '32bd3bb9b3313b9f259f7c8d6c9221f3829c828cf31668f85145e3f0a47b9882';
    process.env['REDIS_URL'] = '';
    process.env['LOG_LEVEL'] = 'fatal';
    process.env['CORS_ORIGINS'] = 'http://localhost:5173';
    process.env['META_CLIENT_ID'] = 'test-meta-client-id';
    process.env['META_CLIENT_SECRET'] = 'test-meta-client-secret';
    process.env['META_REDIRECT_URI'] = 'http://localhost:4000/api/v1/channels/instagram/callback';
    process.env['DASHBOARD_URL'] = 'http://localhost:5173';
}
