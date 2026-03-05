import mongoose from 'mongoose';
import { Channel, type IChannelDocument } from '../models/Channel.js';
import { encrypt } from '../utils/encryption.js';

export interface ChannelResponse {
    id: string;
    platform: string;
    displayName: string;
    handle: string;
    followerCount: number;
    syncStatus: string;
    lastSyncedAt: Date | null;
    createdAt: Date;
}

export function toChannelResponse(doc: IChannelDocument): ChannelResponse {
    return {
        id: doc._id.toString(),
        platform: doc.platform,
        displayName: doc.displayName,
        handle: doc.handle,
        followerCount: doc.followerCount,
        syncStatus: doc.syncStatus,
        lastSyncedAt: doc.lastSyncedAt ?? null,
        createdAt: doc.createdAt,
    };
}

export async function listChannelsByUser(userId: string): Promise<ChannelResponse[]> {
    const channels = await Channel.find({
        userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    return channels.map(toChannelResponse);
}

export interface UpsertChannelParams {
    userId: string;
    platform: 'instagram' | 'linkedin';
    platformAccountId: string;
    displayName: string;
    handle: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
}

export async function upsertChannel(params: UpsertChannelParams): Promise<IChannelDocument> {
    const {
        userId,
        platform,
        platformAccountId,
        displayName,
        handle,
        accessToken,
        refreshToken,
        tokenExpiresAt,
    } = params;

    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : undefined;

    const update: Record<string, unknown> = {
        $set: {
            displayName,
            handle,
            accessToken: encryptedAccess,
            ...(encryptedRefresh !== undefined && { refreshToken: encryptedRefresh }),
            ...(tokenExpiresAt !== undefined && { tokenExpiresAt }),
            syncStatus: 'active',
        },
    };

    const channel = await Channel.findOneAndUpdate(
        {
            userId: new mongoose.Types.ObjectId(userId),
            platform,
            platformAccountId,
        },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return channel;
}
