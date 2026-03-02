import type { Types } from 'mongoose';
import type { IChannel, IPost, IUser } from '../../models/index.js';

export type SeedPlatform = 'instagram' | 'linkedin';
export type SeedPostType = 'text' | 'image' | 'video' | 'link' | 'carousel';

export type SeedUserDocument = Omit<IUser, 'createdAt' | 'updatedAt'> & { _id: Types.ObjectId };
export type SeedChannelDocument = Omit<IChannel, 'createdAt' | 'updatedAt'> & { _id: Types.ObjectId };
export type SeedPostDocument = Omit<IPost, 'createdAt' | 'updatedAt'> & { _id: Types.ObjectId };

export interface GeneratedSeedData {
    seed: string;
    generatedAt: Date;
    user: SeedUserDocument;
    channels: SeedChannelDocument[];
    posts: SeedPostDocument[];
}

export interface SeedSummary {
    usersCount: number;
    channelsCount: number;
    postsByPlatform: Record<SeedPlatform, number>;
    avgEngagementRateByPlatform: Record<SeedPlatform, number>;
}

export interface GenerateSeedDatasetOptions {
    seed?: string;
    now?: Date;
    postCountPerPlatform?: number;
}
