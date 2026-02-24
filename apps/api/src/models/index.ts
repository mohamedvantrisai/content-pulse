// ─── Models ──────────────────────────────────────────────────
export { User } from './User.js';
export { Channel } from './Channel.js';
export { Post } from './Post.js';
export { AnalyticsSnapshot } from './AnalyticsSnapshot.js';
export { ApiKey, API_KEY_SCOPES } from './ApiKey.js';

// ─── Interfaces & Types ─────────────────────────────────────
export type { IUser, IUserDocument, IUserModel, IEmailReportPreferences } from './User.js';
export type { IChannel, IChannelDocument, IChannelModel } from './Channel.js';
export type {
    IPost,
    IPostDocument,
    IPostModel,
    IPostMetrics,
    IMetricsHistoryEntry,
} from './Post.js';
export type {
    IAnalyticsSnapshot,
    IAnalyticsSnapshotDocument,
    IAnalyticsSnapshotModel,
    ISnapshotMetrics,
} from './AnalyticsSnapshot.js';
export type {
    IApiKey,
    IApiKeyDocument,
    IApiKeyModel,
    IGenerateApiKeyResult,
    ApiKeyScope,
} from './ApiKey.js';
