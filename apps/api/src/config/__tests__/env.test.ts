/**
 * TC-1: Verify env.ts parses valid environment variables with correct types.
 * TC-2: Verify env.ts throws descriptive error when required vars are missing.
 */

describe('env', () => {
    const VALID_ENV = {
        NODE_ENV: 'test',
        PORT: '4000',
        MONGODB_URI: 'mongodb://localhost:27017/testdb',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        LOG_LEVEL: 'info',
        CORS_ORIGINS: 'http://localhost:5173',
    };

    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, ...VALID_ENV };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('TC-1: parses all required env vars with correct types', async () => {
        const { env } = await import('../env.js');

        expect(env.PORT).toBe(4000);
        expect(typeof env.PORT).toBe('number');
        expect(env.NODE_ENV).toBe('test');
        expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/testdb');
        expect(env.REDIS_URL).toBe('redis://localhost:6379');
        expect(env.JWT_SECRET).toBe('a'.repeat(32));
        expect(env.ENCRYPTION_KEY).toBe('a'.repeat(64));
        expect(env.LOG_LEVEL).toBe('info');
        expect(env.CORS_ORIGINS).toBe('http://localhost:5173');
    });

    it('TC-1: applies defaults for optional vars', async () => {
        delete process.env['PORT'];
        delete process.env['LOG_LEVEL'];
        delete process.env['CORS_ORIGINS'];
        delete process.env['REDIS_URL'];

        const { env } = await import('../env.js');

        expect(env.PORT).toBe(4000);
        expect(env.LOG_LEVEL).toBe('info');
        expect(env.CORS_ORIGINS).toBe('http://localhost:5173');
        expect(env.REDIS_URL).toBe('');
    });

    it('TC-2: throws descriptive error when MONGODB_URI is missing', async () => {
        delete process.env['MONGODB_URI'];

        await expect(import('../env.js')).rejects.toThrow('MONGODB_URI');
    });

    it('TC-2: throws descriptive error when JWT_SECRET is too short', async () => {
        process.env['JWT_SECRET'] = 'short';

        await expect(import('../env.js')).rejects.toThrow('JWT_SECRET');
    });

    it('TC-2: throws descriptive error when ENCRYPTION_KEY is invalid hex', async () => {
        process.env['ENCRYPTION_KEY'] = 'not-a-hex-string';

        await expect(import('../env.js')).rejects.toThrow('ENCRYPTION_KEY');
    });
});
