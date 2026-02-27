import { z } from 'zod';
import { listChannels } from '../../services/channels.service.js';
import type { GraphQLContext } from '../context.js';
import { validateArgs, requireAuth } from '../validation.js';

const channelByIdInput = z.object({
    id: z.string().min(1, 'id is required'),
});

const postsByChannelInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
});

export const channelResolvers = {
    Query: {
        channels: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            requireAuth(ctx);
            return listChannels();
        },

        channel: (
            _parent: unknown,
            args: { id: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            validateArgs(channelByIdInput, args);
            const channels = listChannels();
            return channels.find((c) => c.id === args.id) ?? null;
        },

        posts: (
            _parent: unknown,
            args: { channelId: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            validateArgs(postsByChannelInput, args);
            return [];
        },
    },
};
