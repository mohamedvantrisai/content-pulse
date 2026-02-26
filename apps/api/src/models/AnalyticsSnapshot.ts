import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interfaces ─
export interface ISnapshotMetrics {
    totalPosts: number;
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    engagementRate: number;
    followerGrowth: number;
    bestPostingHour: number | null;
    bestPostingDay: number | null;
    topPostId: mongoose.Types.ObjectId | null;
}

export interface IAnalyticsSnapshot {
    channelId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    platform: 'instagram' | 'linkedin';
    period: 'daily' | 'weekly' | 'monthly';
    date: Date;
    metrics: ISnapshotMetrics;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAnalyticsSnapshotDocument extends IAnalyticsSnapshot, Document { }

export type IAnalyticsSnapshotModel = Model<IAnalyticsSnapshotDocument>;

// ─── Sub-Schema ──
const snapshotMetricsSchema = new Schema(
    {
        totalPosts: { type: Number, default: 0 },
        totalImpressions: { type: Number, default: 0 },
        totalReach: { type: Number, default: 0 },
        totalEngagements: { type: Number, default: 0 },
        engagementRate: { type: Number, default: 0 },
        followerGrowth: { type: Number, default: 0 },
        bestPostingHour: { type: Number, min: 0, max: 23, default: null },
        bestPostingDay: { type: Number, min: 0, max: 6, default: null },
        topPostId: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    },
    { _id: false },
);

// ─── Schema ───
const analyticsSnapshotSchema = new Schema<
    IAnalyticsSnapshotDocument,
    IAnalyticsSnapshotModel
>(
    {
        channelId: {
            type: Schema.Types.ObjectId,
            ref: 'Channel',
            required: [true, 'Channel ID is required'],
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        platform: {
            type: String,
            required: [true, 'Platform is required'],
            enum: {
                values: ['instagram', 'linkedin'],
                message: '{VALUE} is not a supported platform',
            },
        },
        period: {
            type: String,
            required: [true, 'Period is required'],
            enum: {
                values: ['daily', 'weekly', 'monthly'],
                message: '{VALUE} is not a valid period',
            },
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
        },
        metrics: {
            type: snapshotMetricsSchema,
            default: () => ({}),
        },
    },
    { timestamps: true },
);

// ─── Indexes ─────
analyticsSnapshotSchema.index(
    { channelId: 1, period: 1, date: 1 },
    { unique: true, name: 'channelId_period_date_unique' },
);
analyticsSnapshotSchema.index(
    { userId: 1, period: 1, date: -1 },
    { name: 'userId_period_date_desc' },
);
analyticsSnapshotSchema.index(
    { channelId: 1, date: -1 },
    { name: 'channelId_date_desc' },
);

// ─── Serialisation ──
analyticsSnapshotSchema.set('toJSON', {
    transform(_doc, ret) {
        const { __v: _, ...rest } = ret;
        return rest;
    },
});

// ─── Model ──
export const AnalyticsSnapshot = mongoose.model<
    IAnalyticsSnapshotDocument,
    IAnalyticsSnapshotModel
>('AnalyticsSnapshot', analyticsSnapshotSchema);
