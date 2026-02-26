import mongoose, { Schema, Document, Model } from 'mongoose';

/**Interfaces*/
export interface IPostMetrics {
    impressions: number;
    reach: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves: number;
}

export interface IMetricsHistoryEntry {
    metrics: IPostMetrics;
    recordedAt: Date;
}

export interface IPost {
    channelId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    platformPostId: string;
    platform: 'instagram' | 'linkedin';
    content: string;
    mediaUrls: string[];
    postType: 'text' | 'image' | 'video' | 'link' | 'carousel';
    publishedAt: Date;
    metrics: IPostMetrics;
    metricsHistory: IMetricsHistoryEntry[];
    engagementRate: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPostDocument extends IPost, Document { }

export type IPostModel = Model<IPostDocument>;

/**Sub-Schemas*/
const postMetricsSchema = new Schema(
    {
        impressions: { type: Number, default: 0, min: 0 },
        reach: { type: Number, default: 0, min: 0 },
        engagements: { type: Number, default: 0, min: 0 },
        likes: { type: Number, default: 0, min: 0 },
        comments: { type: Number, default: 0, min: 0 },
        shares: { type: Number, default: 0, min: 0 },
        clicks: { type: Number, default: 0, min: 0 },
        saves: { type: Number, default: 0, min: 0 },
    },
    { _id: false },
);

const metricsHistoryEntrySchema = new Schema(
    {
        metrics: { type: postMetricsSchema, required: true },
        recordedAt: { type: Date, required: true },
    },
    { _id: false },
);

/**Helpers*/
/** Computes engagement rate as (engagements / impressions) × 100. */
function computeEngagementRate(metrics: IPostMetrics): number {
    if (!metrics || metrics.impressions <= 0) return 0;
    return parseFloat(((metrics.engagements / metrics.impressions) * 100).toFixed(4));
}

/**Schema*/
const postSchema = new Schema<IPostDocument, IPostModel>(
    {
        channelId: {
            type: Schema.Types.ObjectId,
            ref: 'Channel',
            required: [true, 'Channel ID is required'],
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        platformPostId: {
            type: String,
            required: [true, 'Platform Post ID is required'],
        },
        platform: {
            type: String,
            required: [true, 'Platform is required'],
            enum: {
                values: ['instagram', 'linkedin'],
                message: '{VALUE} is not a supported platform',
            },
        },
        content: { type: String, default: '' },
        mediaUrls: { type: [String], default: [] },
        postType: {
            type: String,
            required: [true, 'Post type is required'],
            enum: {
                values: ['text', 'image', 'video', 'link', 'carousel'],
                message: '{VALUE} is not a valid post type',
            },
        },
        publishedAt: {
            type: Date,
            required: [true, 'Published date is required'],
            index: true,
        },
        metrics: {
            type: postMetricsSchema,
            default: () => ({}),
        },
        metricsHistory: {
            type: [metricsHistoryEntrySchema],
            default: [],
        },
        engagementRate: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true },
);

/**Indexes*/
postSchema.index(
    { userId: 1, publishedAt: -1 },
    { name: 'userId_publishedAt_desc' },
);
postSchema.index(
    { channelId: 1, publishedAt: -1 },
    { name: 'channelId_publishedAt_desc' },
);
postSchema.index(
    { channelId: 1, platformPostId: 1 },
    { unique: true, name: 'channelId_platformPostId_unique' },
);
postSchema.index(
    { userId: 1, engagementRate: -1, publishedAt: -1 },
    { name: 'userId_engagementRate_publishedAt' },
);

/**Hooks*/
postSchema.pre('save', function (next) {
    if (this.isModified('metrics')) {
        this.engagementRate = computeEngagementRate(this.metrics);
    }
    next();
});

postSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate() as Record<string, unknown> | null;
    if (!update) return next();

    const setBlock = update['$set'] as Record<string, unknown> | undefined;
    if (setBlock?.['metrics']) {
        const metrics = setBlock['metrics'] as IPostMetrics;
        setBlock['engagementRate'] = computeEngagementRate(metrics);
    }

    next();
});

/**Serialisation*/
postSchema.set('toJSON', {
    transform(_doc, ret) {
        const { __v: _, ...rest } = ret;
        return rest;
    },
});

/**Model*/
export const Post = mongoose.model<IPostDocument, IPostModel>('Post', postSchema);
