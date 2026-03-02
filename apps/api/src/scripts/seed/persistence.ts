import { createCipheriv, createHash } from 'node:crypto';
import { Channel, Post, User } from '../../models/index.js';
import type { GeneratedSeedData } from './types.js';

const ALGORITHM = 'aes-256-gcm';

export interface PersistSeedResult {
    usersCount: number;
    channelsCount: number;
    postsCount: number;
}

function encryptionKeyBuffer(): Buffer {
    const hex = process.env['ENCRYPTION_KEY'];
    if (!hex || hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(hex, 'hex');
}

function deterministicEncrypt(plaintext: string, seed: string, tokenKey: string): string {
    const key = encryptionKeyBuffer();
    const iv = createHash('sha256').update(`${seed}:${tokenKey}`).digest().subarray(0, 16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

function withEncryptedTokens(data: GeneratedSeedData): GeneratedSeedData['channels'] {
    return data.channels.map((channel) => ({
        ...channel,
        accessToken: deterministicEncrypt(
            channel.accessToken,
            data.seed,
            `${channel.platform}:access`,
        ),
        refreshToken: channel.refreshToken
            ? deterministicEncrypt(channel.refreshToken, data.seed, `${channel.platform}:refresh`)
            : undefined,
    }));
}

export async function clearSeedCollections(): Promise<void> {
    await Promise.all([
        Post.deleteMany({}),
        Channel.deleteMany({}),
        User.deleteMany({}),
    ]);
}

export async function persistSeedData(data: GeneratedSeedData): Promise<PersistSeedResult> {
    await clearSeedCollections();

    await User.insertMany([data.user], { ordered: true });

    const encryptedChannels = withEncryptedTokens(data);
    await Channel.insertMany(encryptedChannels, { ordered: true });

    await User.bulkWrite([
        {
            updateOne: {
                filter: { _id: data.user._id },
                update: {
                    $set: {
                        'emailReportPreferences.channelIds': encryptedChannels.map((channel) => channel._id),
                    },
                },
            },
        },
    ]);

    await Post.insertMany(data.posts, { ordered: false });

    return {
        usersCount: 1,
        channelsCount: encryptedChannels.length,
        postsCount: data.posts.length,
    };
}
