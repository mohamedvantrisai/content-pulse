import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    PORT: z
        .string()
        .default('4000')
        .transform(Number)
        .pipe(z.number().int().positive()),

    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),

    MONGODB_URI: z
        .string({ required_error: 'MONGODB_URI is required' })
        .startsWith('mongodb', 'MONGODB_URI must start with "mongodb"'),

    REDIS_URL: z.string().default(''),

    JWT_SECRET: z
        .string({ required_error: 'JWT_SECRET is required' })
        .min(32, 'JWT_SECRET must be at least 32 characters'),

    ENCRYPTION_KEY: z
        .string({ required_error: 'ENCRYPTION_KEY is required' })
        .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be a 64-character hex string'),

    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),

    CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates environment variables using Zod.
 * Throws a descriptive error listing all invalid fields on failure.
 */
function parseEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        const message = `\n❌ Environment validation failed:\n${formatted}\n`;

        // In test mode, throw so tests can catch it
        if (process.env['NODE_ENV'] === 'test') {
            throw new Error(message);
        }

        console.error(message);
        process.exit(1);
    }

    return Object.freeze(result.data);
}

export const env = parseEnv();
