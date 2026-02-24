import mongoose, { Schema, Document, Model } from 'mongoose';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

// ─── Interfaces ──────────────────────────────────────────────

export interface IChannel {
    userId: mongoose.Types.ObjectId;
    platform: 'instagram' | 'linkedin';
    platformAccountId: string;
    displayName: string;
    handle: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    followerCount: number;
    syncStatus: 'active' | 'paused' | 'error' | 'pending';
    syncErrorMessage?: string;
    lastSyncedAt?: Date;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IChannelDocument extends IChannel, Document {
    getDecryptedAccessToken(): string;
    getDecryptedRefreshToken(): string;
}

export type IChannelModel = Model<IChannelDocument>;

// ─── Schema ──────────────────────────────────────────────────

const channelSchema = new Schema<IChannelDocument, IChannelModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        platform: {
            type: String,
            required: [true, 'Platform is required'],
            enum: {
                values: ['instagram', 'linkedin'],
                message: '{VALUE} is not a supported platform',
            },
        },
        platformAccountId: {
            type: String,
            required: [true, 'Platform Account ID is required'],
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
        },
        handle: {
            type: String,
            trim: true,
            default: '',
        },
        accessToken: {
            type: String,
            required: [true, 'Access token is required'],
            select: false,
        },
        refreshToken: {
            type: String,
            select: false,
        },
        tokenExpiresAt: {
            type: Date,
        },
        followerCount: {
            type: Number,
            default: 0,
            min: [0, 'Follower count cannot be negative'],
        },
        syncStatus: {
            type: String,
            enum: {
                values: ['active', 'paused', 'error', 'pending'],
                message: '{VALUE} is not a valid sync status',
            },
            default: 'pending',
        },
        syncErrorMessage: {
            type: String,
        },
        lastSyncedAt: {
            type: Date,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: () => ({}),
        },
    },
    { timestamps: true },
);

// ─── Indexes ─────────────────────────────────────────────────

channelSchema.index(
    { userId: 1, platform: 1, platformAccountId: 1 },
    { unique: true, name: 'userId_platform_platformAccountId_unique' },
);
channelSchema.index(
    { userId: 1, syncStatus: 1 },
    { name: 'userId_syncStatus' },
);

// ─── Hooks ───────────────────────────────────────────────────

channelSchema.pre('save', function (next) {
    if (this.isModified('accessToken') && this.accessToken && !isEncrypted(this.accessToken)) {
        this.accessToken = encrypt(this.accessToken);
    }

    if (this.isModified('refreshToken') && this.refreshToken && !isEncrypted(this.refreshToken)) {
        this.refreshToken = encrypt(this.refreshToken);
    }

    next();
});

// ─── Methods ─────────────────────────────────────────────────

channelSchema.methods.getDecryptedAccessToken = function (
    this: IChannelDocument,
): string {
    return decrypt(this.accessToken);
};

channelSchema.methods.getDecryptedRefreshToken = function (
    this: IChannelDocument,
): string {
    if (!this.refreshToken) return '';
    return decrypt(this.refreshToken);
};

// ─── Serialisation ───────────────────────────────────────────

channelSchema.set('toJSON', {
    transform(_doc, ret) {
        const { accessToken: _, refreshToken: __, __v: ___, ...rest } = ret;
        return rest;
    },
});

// ─── Model ───────────────────────────────────────────────────

export const Channel = mongoose.model<IChannelDocument, IChannelModel>('Channel', channelSchema);
