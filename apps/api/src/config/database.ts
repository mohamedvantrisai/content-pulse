import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Connects to MongoDB with retry logic (3 attempts, exponential backoff).
 * Logs connection success or failure with descriptive context.
 */
export async function connect(): Promise<typeof mongoose> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const connection = await mongoose.connect(env.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            const { host, port, name } = connection.connection;
            logger.info({ host, port, db: name }, 'MongoDB connected');

            return connection;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                logger.warn(
                    { attempt, maxRetries: MAX_RETRIES, nextRetryMs: delay },
                    `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed, retrying...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(
        { error: lastError?.message },
        `MongoDB connection failed after ${MAX_RETRIES} attempts`,
    );

    throw new Error(
        `MongoDB connection failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    );
}

/** Cleanly disconnects from MongoDB. */
export async function disconnect(): Promise<void> {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
}
