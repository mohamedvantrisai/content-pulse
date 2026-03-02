import { generateSeedDataset } from './seed/generator.js';
import { persistSeedData } from './seed/persistence.js';
import { collectSeedSummary } from './seed/stats.js';
import type { SeedSummary } from './seed/types.js';

interface LoggerLike {
    info: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
}

interface SeedDependencies {
    connect: () => Promise<unknown>;
    disconnect: () => Promise<void>;
    logger: LoggerLike;
}

interface RunSeedOptions {
    seed?: string;
    now?: Date;
    deps?: SeedDependencies;
}

async function createDefaultDependencies(): Promise<SeedDependencies> {
    if (!process.env['MONGODB_URI'] && process.env['MONGO_URI']) {
        process.env['MONGODB_URI'] = process.env['MONGO_URI'];
    }

    const [{ connectDatabase, disconnectDatabase }, { logger }] = await Promise.all([
        import('../config/index.js'),
        import('../lib/logger.js'),
    ]);

    return {
        connect: connectDatabase,
        disconnect: disconnectDatabase,
        logger: {
            info: logger.info.bind(logger),
            error: logger.error.bind(logger),
        },
    };
}

export async function runSeed(options: RunSeedOptions = {}): Promise<SeedSummary> {
    const deps = options.deps ?? await createDefaultDependencies();

    await deps.connect();
    try {
        const generated = generateSeedDataset({
            seed: options.seed,
            now: options.now,
        });

        await persistSeedData(generated);
        const summary = await collectSeedSummary();

        deps.logger.info(
            {
                seed: generated.seed,
                usersCount: summary.usersCount,
                channelsCount: summary.channelsCount,
                postsByPlatform: summary.postsByPlatform,
                avgEngagementRateByPlatform: summary.avgEngagementRateByPlatform,
            },
            'Seed completed',
        );

        return summary;
    } finally {
        await deps.disconnect();
    }
}

async function main(): Promise<void> {
    const deps = await createDefaultDependencies();

    try {
        await runSeed({ deps });
        process.exitCode = 0;
    } catch (error) {
        deps.logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'Seed failed',
        );
        process.exitCode = 1;
    }
}

function isDirectExecution(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    return entry.endsWith('/src/scripts/seed.ts') || entry.endsWith('\\src\\scripts\\seed.ts');
}

if (isDirectExecution()) {
    void main();
}
