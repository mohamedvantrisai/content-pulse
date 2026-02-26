import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

// ─── Constants ───
const BCRYPT_ROUNDS = 12;
const KEY_BODY_LENGTH = 40;
const KEY_PREFIX_LENGTH = 12;
const KEY_PREFIX_TAG = 'cp_';

export const API_KEY_SCOPES = [
    'analytics:read',
    'channels:read',
    'channels:write',
    'strategist:read',
    'posts:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

// ─── Interfaces ───
export interface IApiKey {
    userId: mongoose.Types.ObjectId;
    name: string;
    keyHash: string;
    keyPrefix: string;
    scopes: ApiKeyScope[];
    rateLimit: number;
    lastUsedAt?: Date;
    totalRequests: number;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IApiKeyDocument extends IApiKey, Document {
    verifyApiKey(candidateKey: string): Promise<boolean>;
    hasScope(scope: ApiKeyScope): boolean;
    recordUsage(): Promise<void>;
}

export interface IGenerateApiKeyResult {
    fullKey: string;
    keyPrefix: string;
    keyHash: string;
}

export interface IApiKeyModel extends Model<IApiKeyDocument> {
    generateApiKey(): Promise<IGenerateApiKeyResult>;
    findByPrefix(prefix: string): Promise<IApiKeyDocument | null>;
}

// ─── Schema ────
const apiKeySchema = new Schema<IApiKeyDocument, IApiKeyModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        name: {
            type: String,
            required: [true, 'API key name is required'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        keyHash: {
            type: String,
            required: [true, 'Key hash is required'],
            select: false,
        },
        keyPrefix: {
            type: String,
            required: [true, 'Key prefix is required'],
            index: true,
        },
        scopes: {
            type: [
                {
                    type: String,
                    enum: {
                        values: API_KEY_SCOPES,
                        message: '{VALUE} is not a valid scope',
                    },
                },
            ],
            validate: {
                validator: (v: string[]) => v.length >= 1,
                message: 'At least one scope is required',
            },
        },
        rateLimit: {
            type: Number,
            default: 60,
            min: [1, 'Rate limit must be at least 1'],
            max: [1000, 'Rate limit cannot exceed 1000'],
        },
        lastUsedAt: { type: Date },
        totalRequests: { type: Number, default: 0 },
        expiresAt: { type: Date },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

// ─── Indexes ───
apiKeySchema.index(
    { userId: 1, isActive: 1 },
    { name: 'userId_isActive' },
);
apiKeySchema.index(
    { expiresAt: 1 },
    { sparse: true, name: 'expiresAt_sparse' },
);

// ─── Static Methods ───
apiKeySchema.statics.generateApiKey = async function (): Promise<IGenerateApiKeyResult> {
    const body = randomBytes(KEY_BODY_LENGTH).toString('hex').slice(0, KEY_BODY_LENGTH);
    const fullKey = `${KEY_PREFIX_TAG}${body}`;
    const keyPrefix = body.slice(0, KEY_PREFIX_LENGTH);
    const keyHash = await bcrypt.hash(fullKey, BCRYPT_ROUNDS);

    return { fullKey, keyPrefix, keyHash };
};

apiKeySchema.statics.findByPrefix = function (
    prefix: string,
): Promise<IApiKeyDocument | null> {
    return this.findOne({ keyPrefix: prefix, isActive: true }).select('+keyHash').exec();
};

// ─── Instance Methods ───
apiKeySchema.methods.verifyApiKey = async function (
    this: IApiKeyDocument,
    candidateKey: string,
): Promise<boolean> {
    return bcrypt.compare(candidateKey, this.keyHash);
};

apiKeySchema.methods.hasScope = function (
    this: IApiKeyDocument,
    scope: ApiKeyScope,
): boolean {
    return this.scopes.includes(scope);
};

apiKeySchema.methods.recordUsage = async function (
    this: IApiKeyDocument,
): Promise<void> {
    this.lastUsedAt = new Date();
    this.totalRequests += 1;
    await this.save();
};

// ─── Serialisation ────
apiKeySchema.set('toJSON', {
    transform(_doc, ret) {
        const { keyHash: _, __v: __, ...rest } = ret;
        return rest;
    },
});

// ─── Model ────
export const ApiKey = mongoose.model<IApiKeyDocument, IApiKeyModel>('ApiKey', apiKeySchema);
