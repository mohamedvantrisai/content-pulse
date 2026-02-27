import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { listChannels } from '../../services/channels.service.js';
import type { GraphQLContext } from '../context.js';

const channelByIdInput = z.object({
    id: z.string().min(1, 'id is required'),
});

const postsByChannelInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
});

export const channelResolvers = {
    Query: {
        channels: (_parent: unknown, _args: unknown, _ctx: GraphQLContext) => {
            return listChannels();
        },

        channel: (
            _parent: unknown,
            args: { id: string },
            _ctx: GraphQLContext,
        ) => {
            const result = channelByIdInput.safeParse(args);
            if (!result.success) {
                throw new GraphQLError('Invalid input', {
                    extensions: {
                        code: 'VALIDATION_ERROR',
                        validationErrors: result.error.issues.map((i) => ({
                            path: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                });
            }
            const channels = listChannels();
            return channels.find((c) => c.id === args.id) ?? null;
        },

        posts: (
            _parent: unknown,
            args: { channelId: string },
            _ctx: GraphQLContext,
        ) => {
            const result = postsByChannelInput.safeParse(args);
            if (!result.success) {
                throw new GraphQLError('Invalid input', {
                    extensions: {
                        code: 'VALIDATION_ERROR',
                        validationErrors: result.error.issues.map((i) => ({
                            path: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                });
            }
            return [];
        },
    },
};
