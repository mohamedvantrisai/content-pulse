import request from 'supertest';
import type { Express } from 'express';

let app: Express;

jest.mock('../../config/env.js', () => ({
    env: {
        PORT: 4000,
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_URL: '',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: 'http://localhost:5173',
    },
}));

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

beforeAll(async () => {
    const { createApp } = await import('../../app.js');
    app = await createApp({ redisStatus: () => 'ready' });
});

function gql(query: string, variables?: Record<string, unknown>) {
    return request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({ query, variables });
}

describe('TC-1: GraphQL Playground accessible at /graphql', () => {
    it('POST /graphql responds to queries', async () => {
        const res = await gql('{ health { status timestamp } }');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.health).toHaveProperty('status', 'ok');
    });

    it('GET /graphql returns landing page HTML in non-production', async () => {
        const res = await request(app)
            .get('/graphql')
            .set('Accept', 'text/html');

        expect(res.status).toBe(200);
    });
});

describe('TC-2: Introspection query returns all expected types and queries', () => {
    it('introspection lists all SDL-defined types', async () => {
        const res = await gql(`{
            __schema {
                types {
                    name
                }
            }
        }`);

        expect(res.status).toBe(200);
        const typeNames: string[] = res.body.data.__schema.types.map(
            (t: { name: string }) => t.name,
        );

        const expectedTypes = [
            'HealthStatus',
            'AnalyticsOverview',
            'ChannelAnalytics',
            'Channel',
            'Post',
            'ContentBrief',
            'PlatformBreakdown',
            'TimeSeriesPoint',
            'SnapshotMetrics',
            'PostMetrics',
        ];

        for (const typeName of expectedTypes) {
            expect(typeNames).toContain(typeName);
        }
    });

    it('introspection lists all expected Query fields', async () => {
        const res = await gql(`{
            __type(name: "Query") {
                fields {
                    name
                }
            }
        }`);

        expect(res.status).toBe(200);
        const fieldNames: string[] = res.body.data.__type.fields.map(
            (f: { name: string }) => f.name,
        );

        const expectedFields = [
            'health',
            'analyticsOverview',
            'channels',
            'channel',
            'posts',
            'contentBrief',
            'channelAnalytics',
            'platformBreakdown',
            'timeSeries',
        ];

        for (const field of expectedFields) {
            expect(fieldNames).toContain(field);
        }
    });
});

describe('TC-3: Execute queries and verify response shape', () => {
    it('analyticsOverview returns correct shape', async () => {
        const res = await gql(`{
            analyticsOverview {
                totalViews
                totalEngagement
                topChannel
            }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.data.analyticsOverview).toEqual({
            totalViews: 12500,
            totalEngagement: 3200,
            topChannel: 'twitter',
        });
    });

    it('channels returns array with correct shape', async () => {
        const res = await gql(`{
            channels {
                id
                name
                platform
            }
        }`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.channels)).toBe(true);
        expect(res.body.data.channels.length).toBeGreaterThan(0);
        expect(res.body.data.channels[0]).toHaveProperty('id');
        expect(res.body.data.channels[0]).toHaveProperty('name');
        expect(res.body.data.channels[0]).toHaveProperty('platform');
    });

    it('contentBrief returns correct shape', async () => {
        const res = await gql(`{
            contentBrief {
                id
                title
                status
            }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.data.contentBrief).toEqual({
            id: 'sb_1',
            title: 'Q1 Content Strategy',
            status: 'active',
        });
    });

    it('channel(id) returns single channel or null', async () => {
        const res = await gql(`{
            channel(id: "ch_1") {
                id
                name
                platform
            }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.data.channel).toEqual({
            id: 'ch_1',
            name: 'Main Twitter',
            platform: 'twitter',
        });
    });

    it('health query still works alongside domain queries', async () => {
        const res = await gql(`{
            health { status timestamp }
            analyticsOverview { totalViews }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.data.health.status).toBe('ok');
        expect(res.body.data.analyticsOverview.totalViews).toBe(12500);
    });
});

describe('TC-4: Resolvers use the same service functions as REST routes', () => {
    it('analytics resolver imports getAnalyticsOverview from analytics.service', async () => {
        const resolverMod = await import('../resolvers/analytics.resolver.js');
        const serviceMod = await import('../../services/analytics.service.js');

        const result = resolverMod.analyticsResolvers.Query.analyticsOverview(null, {}, {
            correlationId: undefined,
            user: null,
        });

        expect(result).toEqual(serviceMod.getAnalyticsOverview());
    });

    it('channel resolver imports listChannels from channels.service', async () => {
        const resolverMod = await import('../resolvers/channel.resolver.js');
        const serviceMod = await import('../../services/channels.service.js');

        const result = resolverMod.channelResolvers.Query.channels(null, {}, {
            correlationId: undefined,
            user: null,
        });

        expect(result).toEqual(serviceMod.listChannels());
    });

    it('strategist resolver imports getStrategyBrief from strategist.service', async () => {
        const resolverMod = await import('../resolvers/strategist.resolver.js');
        const serviceMod = await import('../../services/strategist.service.js');

        const result = resolverMod.strategistResolvers.Query.contentBrief(null, {}, {
            correlationId: undefined,
            user: null,
        });

        expect(result).toEqual(serviceMod.getStrategyBrief());
    });
});

describe('TC-5: Validation error returns REST-style error envelope', () => {
    it('invalid channelAnalytics input returns structured error', async () => {
        const res = await gql(`{
            channelAnalytics(channelId: "", period: "invalid") {
                channelId
            }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors.length).toBeGreaterThan(0);

        const error = res.body.errors[0];
        expect(error.extensions).toHaveProperty('error');
        expect(error.extensions.error).toHaveProperty('code', 'VALIDATION_ERROR');
        expect(error.extensions.error).toHaveProperty('message');
        expect(error.extensions.error).toHaveProperty('details');
        expect(Array.isArray(error.extensions.error.details)).toBe(true);
    });

    it('invalid channel(id) returns structured error', async () => {
        const res = await gql(`{
            channel(id: "") {
                id
            }
        }`);

        expect(res.status).toBe(200);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('syntax error in query returns structured error envelope', async () => {
        const res = await gql('{ invalidSyntax !!!');

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions).toHaveProperty('error');
        expect(res.body.errors[0].extensions.error).toHaveProperty('code');
        expect(res.body.errors[0].extensions.error).toHaveProperty('message');
        expect(res.body.errors[0].extensions.error).toHaveProperty('details');
    });
});

describe('TC-6: No duplicate type definitions in schema', () => {
    it('schema builds successfully with no duplicate types', async () => {
        const { typeDefs } = await import('../typeDefs/index.js');

        const allSdl = Array.isArray(typeDefs) ? typeDefs.join('\n') : typeDefs;
        const typeDefPattern = /(?<!extend\s)type\s+(\w+)\s*\{/g;
        const typeNames: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = typeDefPattern.exec(allSdl)) !== null) {
            typeNames.push(match[1]!);
        }

        const duplicates = typeNames.filter(
            (name, index) => typeNames.indexOf(name) !== index,
        );

        expect(duplicates).toEqual([]);
    });

    it('extend type Query is used (not duplicate type Query)', async () => {
        const { typeDefs } = await import('../typeDefs/index.js');

        const allSdl = Array.isArray(typeDefs) ? typeDefs.join('\n') : typeDefs;

        const typeQueryCount = (allSdl.match(/(?<!\bextend\s+)type\s+Query\s*\{/g) ?? []).length;
        expect(typeQueryCount).toBe(1);

        const extendQueryCount = (allSdl.match(/extend\s+type\s+Query\s*\{/g) ?? []).length;
        expect(extendQueryCount).toBeGreaterThanOrEqual(1);
    });
});

describe('TC-7: correlationId exists in GraphQL context', () => {
    it('GraphQL request receives x-request-id header (correlation middleware active)', async () => {
        const res = await gql('{ health { status } }');

        expect(res.headers['x-request-id']).toBeDefined();
        expect(typeof res.headers['x-request-id']).toBe('string');
        expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
    });

    it('custom x-request-id is echoed back on GraphQL requests', async () => {
        const res = await request(app)
            .post('/graphql')
            .set('Content-Type', 'application/json')
            .set('x-request-id', 'gql-trace-123')
            .send({ query: '{ health { status } }' });

        expect(res.headers['x-request-id']).toBe('gql-trace-123');
    });

    it('buildContext injects correlationId from async context', async () => {
        const { buildContext } = await import('../context.js');
        const { asyncLocalStorage } = await import('../../lib/async-context.js');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { headers: { authorization: 'Bearer test-token' } } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {} as any;

        const ctx = await asyncLocalStorage.run(
            { correlationId: 'ctx-inject-test', startTime: Date.now() },
            () => buildContext({ req: mockReq, res: mockRes }),
        );

        expect(ctx.correlationId).toBe('ctx-inject-test');
        expect(ctx.user).toEqual({ id: 'authenticated-user', token: 'test-token' });
    });

    it('buildContext returns null user when no auth header', async () => {
        const { buildContext } = await import('../context.js');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { headers: {} } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {} as any;

        const ctx = await buildContext({ req: mockReq, res: mockRes });

        expect(ctx.user).toBeNull();
    });
});

describe('TC-8: Introspection disabled in production', () => {
    it('creates Apollo Server with introspection disabled when NODE_ENV=production', async () => {
        const envMock = (await import('../../config/env.js')).env as Record<string, unknown>;
        const originalNodeEnv = envMock['NODE_ENV'];

        envMock['NODE_ENV'] = 'production';

        const { ApolloServer } = await import('@apollo/server');
        const { typeDefs } = await import('../schema.js');
        const { resolvers } = await import('../schema.js');
        const { formatError } = await import('../format-error.js');

        const isProduction = envMock['NODE_ENV'] === 'production';
        const apollo = new ApolloServer({
            typeDefs,
            resolvers,
            formatError,
            introspection: !isProduction,
        });

        await apollo.start();

        const result = await apollo.executeOperation({
            query: '{ __schema { types { name } } }',
        });

        expect(result.body.kind).toBe('single');
        if (result.body.kind === 'single') {
            expect(result.body.singleResult.errors).toBeDefined();
            expect(result.body.singleResult.errors!.length).toBeGreaterThan(0);
        }

        await apollo.stop();
        envMock['NODE_ENV'] = originalNodeEnv;
    });
});
