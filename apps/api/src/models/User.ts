import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Interfaces ──────────────────────────────────────────────

export interface IEmailReportPreferences {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek: number;
    channelIds: mongoose.Types.ObjectId[];
}

export interface IUser {
    email: string;
    name: string;
    passwordHash: string;
    plan: 'free' | 'pro' | 'business';
    timezone: string;
    emailReportPreferences: IEmailReportPreferences;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
    comparePassword(candidate: string): Promise<boolean>;
}

export type IUserModel = Model<IUserDocument>;

// ─── Sub-Schema ──────────────────────────────────────────────

const emailReportPreferencesSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly',
        },
        dayOfWeek: { type: Number, min: 0, max: 6, default: 1 },
        channelIds: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    },
    { _id: false },
);

// ─── Schema ──────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

const userSchema = new Schema<IUserDocument, IUserModel>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        passwordHash: {
            type: String,
            required: [true, 'Password hash is required'],
            select: false,
        },
        plan: {
            type: String,
            enum: {
                values: ['free', 'pro', 'business'],
                message: '{VALUE} is not a valid plan',
            },
            default: 'free',
        },
        timezone: {
            type: String,
            default: 'America/New_York',
        },
        emailReportPreferences: {
            type: emailReportPreferencesSchema,
            default: () => ({}),
        },
    },
    { timestamps: true },
);

// ─── Hooks ───────────────────────────────────────────────────

userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();

    // Skip if already a bcrypt hash
    if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$')) {
        return next();
    }

    this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
    next();
});

// ─── Methods ─────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (
    this: IUserDocument,
    candidate: string,
): Promise<boolean> {
    return bcrypt.compare(candidate, this.passwordHash);
};

// ─── Serialisation ───────────────────────────────────────────

userSchema.set('toJSON', {
    transform(_doc, ret) {
        const { passwordHash: _, __v: __, ...rest } = ret;
        return rest;
    },
});

// ─── Model ───────────────────────────────────────────────────

export const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);
