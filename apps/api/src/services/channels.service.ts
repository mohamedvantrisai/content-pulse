import mongoose from 'mongoose';
import { Channel, type IChannelDocument } from '../models/Channel.js';
import { encrypt } from '../utils/encryption.js';
import type { AppError } from '../middleware/error-handler.js';
import type { ChannelDetailAnalyticsResponse } from './analytics.types.js';
import {
    aggregateChannelTimeSeries,
    aggregateContentBreakdown,
    aggregatePostingTimes,
} from './analytics.repository.js';

const FALLBACK_USER_ID = '000000000000000000000000';

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

function channelNotFound(): AppError {
    const error = new Error('Channel not found') as AppError;
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    return error;
}

/**
 * When auth is present, use the authenticated userId.
 * Otherwise fall back to the first channel owner or a zero ObjectId.
 * Kept for GraphQL backward compatibility.
 */
export async function resolveChannelsUserId(userId?: string): Promise<string> {
    if (userId) return userId;

    const firstChannel = await Channel.findOne().select('userId').lean();
    if (firstChannel?.userId) return String(firstChannel.userId);

    return FALLBACK_USER_ID;
}

export async function listChannelsByUser(userId: string): Promise<ChannelResponse[]> {
    const channels = await Channel.find({
        userId: new mongoose.Types.ObjectId(userId),
        syncStatus: { $ne: 'inactive' },
    }).sort({ createdAt: -1 });

    return channels.map(toChannelResponse);
}

export async function getChannelById(userId: string, channelId: string): Promise<ChannelResponse> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFound();

    const doc = await Channel.findOne({
        _id: new mongoose.Types.ObjectId(channelId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    if (!doc) throw channelNotFound();
    return toChannelResponse(doc);
}

export async function updateSyncStatus(
    userId: string,
    channelId: string,
    syncStatus: 'active' | 'paused',
): Promise<ChannelResponse> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFound();

    const doc = await Channel.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(channelId),
            userId: new mongoose.Types.ObjectId(userId),
            syncStatus: { $ne: 'inactive' },
        },
        { $set: { syncStatus } },
        { new: true },
    );

    if (!doc) throw channelNotFound();
    return toChannelResponse(doc);
}

export async function disconnectChannel(userId: string, channelId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw channelNotFound();

    const doc = await Channel.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(channelId),
            userId: new mongoose.Types.ObjectId(userId),
        },
        { $set: { syncStatus: 'inactive', disconnectedAt: new Date() } },
        { new: true },
    );

    if (!doc) throw channelNotFound();
}

/** Returns only channels eligible for sync (syncStatus === 'active'). */
export async function findChannelsForSync(): Promise<IChannelDocument[]> {
    return Channel.find({ syncStatus: 'active' });
}

export async function getChannelDetailAnalytics(
    userId: string,
    channelId: string,
    start: string,
    end: string,
): Promise<ChannelDetailAnalyticsResponse> {
    const channel = await getChannelById(userId, channelId);

    const startUtc = new Date(start + 'T00:00:00.000Z');
    const endUtc = new Date(end + 'T23:59:59.999Z');

    const [timeSeries, contentBreakdown, postingTimes] = await Promise.all([
        aggregateChannelTimeSeries(channelId, startUtc, endUtc),
        aggregateContentBreakdown(channelId, startUtc, endUtc),
        aggregatePostingTimes(channelId, startUtc, endUtc),
    ]);

    return { channel, timeSeries, contentBreakdown, postingTimes };
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
