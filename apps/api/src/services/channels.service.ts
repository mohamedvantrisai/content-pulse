import mongoose from 'mongoose';
import { Channel, type IChannelDocument } from '../models/Channel.js';
import { encrypt } from '../utils/encryption.js';

export interface ChannelListItem {
    id: string;
    name: string;
    platform: string;
}

export function listChannels(): ChannelListItem[] {
    return [
        { id: 'ch_1', name: 'Main Instagram', platform: 'instagram' },
        { id: 'ch_2', name: 'Company LinkedIn', platform: 'linkedin' },
    ];
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
