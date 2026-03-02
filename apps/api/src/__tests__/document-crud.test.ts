/**
 * TC-2: Verify the in-memory MongoDB server works end-to-end.
 *
 * Saves a document via Mongoose, reads it back, and asserts field equality.
 * No local MongoMemoryServer boilerplate — the global Jest setup handles
 * server lifecycle and setup.ts provides the mongoose connection.
 */

import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { getConnection, clearDatabase } from '../test/mongo-manager.js';

interface ITestUser {
    email: string;
    name: string;
}

type TestUserDocument = ITestUser & Document;

const TestUserSchema = new Schema<TestUserDocument>({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
});

const TestUser: Model<TestUserDocument> =
    (mongoose.models['TestUser'] as Model<TestUserDocument> | undefined) ??
    mongoose.model<TestUserDocument>('TestUser', TestUserSchema);

describe('TC-2: In-memory MongoDB document CRUD', () => {
    it('saves a document and reads it back', async () => {
        const doc = await TestUser.create({
            email: 'dev@contentpulse.test',
            name: 'Test User',
        });

        expect(doc._id).toBeDefined();

        const found = await TestUser.findById(doc._id).lean().exec();

        expect(found).not.toBeNull();
        expect(found!.email).toBe('dev@contentpulse.test');
        expect(found!.name).toBe('Test User');
    });

    it('confirms collections are cleaned between tests (no leaks)', async () => {
        const count = await TestUser.countDocuments();
        expect(count).toBe(0);
    });

    it('getConnection() returns an active connection', () => {
        const conn = getConnection();
        expect(conn.readyState).toBe(1);
    });

    it('clearDatabase() removes all documents', async () => {
        await TestUser.create({ email: 'a@test.com', name: 'A' });
        await TestUser.create({ email: 'b@test.com', name: 'B' });

        expect(await TestUser.countDocuments()).toBe(2);

        await clearDatabase();

        expect(await TestUser.countDocuments()).toBe(0);
    });
});
