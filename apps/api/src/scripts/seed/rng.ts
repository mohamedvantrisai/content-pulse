export interface WeightedOption<T> {
    value: T;
    weight: number;
}

const DEFAULT_SEED = 'content-pulse-seed-v1';

function hashSeedToUint32(seed: string): number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export class SeededRng {
    private state: number;

    public constructor(seedInput: string) {
        const initialState = hashSeedToUint32(seedInput);
        this.state = initialState === 0 ? 0x6d2b79f5 : initialState;
    }

    public nextFloat(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    public nextInt(min: number, max: number): number {
        if (max < min) {
            throw new Error(`Invalid range: min(${min}) > max(${max})`);
        }
        const span = max - min + 1;
        return min + Math.floor(this.nextFloat() * span);
    }

    public pickOne<T>(values: readonly T[]): T {
        if (values.length === 0) {
            throw new Error('Cannot pick from an empty list');
        }
        const index = this.nextInt(0, values.length - 1);
        return values[index] as T;
    }

    public pickWeighted<T>(options: readonly WeightedOption<T>[]): T {
        if (options.length === 0) {
            throw new Error('Cannot pick weighted value from an empty list');
        }

        const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
        if (totalWeight <= 0) {
            throw new Error('Total weight must be greater than zero');
        }

        const target = this.nextFloat() * totalWeight;
        let cursor = 0;
        for (const option of options) {
            cursor += option.weight;
            if (target <= cursor) {
                return option.value;
            }
        }

        return options[options.length - 1]!.value;
    }

    public shuffle<T>(values: readonly T[]): T[] {
        const output = [...values];
        for (let index = output.length - 1; index > 0; index -= 1) {
            const swapIndex = this.nextInt(0, index);
            [output[index], output[swapIndex]] = [output[swapIndex] as T, output[index] as T];
        }
        return output;
    }
}

export function resolveSeedValue(seedOverride?: string): string {
    const envSeed = process.env['SEED_RANDOM'];
    if (seedOverride && seedOverride.trim().length > 0) return seedOverride.trim();
    if (envSeed && envSeed.trim().length > 0) return envSeed.trim();
    return DEFAULT_SEED;
}
