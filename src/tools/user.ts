import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';
import { api } from '../api';
import { type Args } from './args';
import { zodTool } from './zod-tool';

const userIdArgs = z.object({ user_id: z.string().min(1) });

export const userTools: Tool[] = [
  zodTool('get_user_profile', "Get a member's public profile on HomeExchange.", userIdArgs),
  zodTool('get_user_achievements', 'Get achievements for a HomeExchange member.', userIdArgs),
  zodTool('get_user_ratings', 'Get ratings left for a HomeExchange member.', userIdArgs),
];

export async function handleUser(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'get_user_profile': {
      const { user_id } = userIdArgs.parse(args);
      return api.get(`/v1/users/${user_id}`);
    }

    case 'get_user_achievements': {
      const { user_id } = userIdArgs.parse(args);
      return api.get(`/v1/achievement/${user_id}`);
    }

    case 'get_user_ratings': {
      const { user_id } = userIdArgs.parse(args);
      return api.get(`/v1/ratings/${user_id}`);
    }

    default:
      throw new Error(`Unknown user tool: ${name}`);
  }
}
