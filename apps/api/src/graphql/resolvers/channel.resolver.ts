import { z } from 'zod';
import { listChannelsByUser, type ChannelResponse } from '../../services/channels.service.js';
import type { GraphQLContext } from '../context.js';
import { validateArgs, requireAuth } from '../validation.js';

const channelByIdInput = z.object({
    id: z.string().min(1, 'id is required'),
});

const postsByChannelInput = z.object({
    channelId: z.string().min(1, 'channelId is required'),
});

function toGraphQLChannel(ch: ChannelResponse) {
    return { id: ch.id, name: ch.displayName, platform: ch.platform };
}

export const channelResolvers = {
    Query: {
        channels: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            requireAuth(ctx);
            const channels = await listChannelsByUser(ctx.user!.id);
            return channels.map(toGraphQLChannel);
        },

        channel: async (
            _parent: unknown,
            args: { id: string },
            ctx: GraphQLContext,
        ) => {
            requireAuth(ctx);
            validateArgs(channelByIdInput, args);
            const channels = await listChannelsByUser(ctx.user!.id);
            const found = channels.find((c) => c.id === args.id);
            return found ? toGraphQLChannel(found) : null;
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
