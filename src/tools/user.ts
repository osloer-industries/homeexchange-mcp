import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';

export const userTools: Tool[] = [
  {
    name: 'get_user_profile',
    description: "Get a member's public profile on HomeExchange.",
    inputSchema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', description: 'Numeric user ID' },
      },
    },
  },
  {
    name: 'get_user_achievements',
    description: "Get achievements for a HomeExchange member.",
    inputSchema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', description: 'Numeric user ID' },
      },
    },
  },
  {
    name: 'get_user_ratings',
    description: "Get ratings left for a HomeExchange member.",
    inputSchema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', description: 'Numeric user ID' },
      },
    },
  },
];

type Args = Record<string, unknown>;

export async function handleUser(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'get_user_profile':
      return api.get(`/v1/users/${args['user_id'] as string}`);

    case 'get_user_achievements':
      return api.get(`/v1/achievement/${args['user_id'] as string}`);

    case 'get_user_ratings':
      return api.get(`/v1/ratings/${args['user_id'] as string}`);

    default:
      throw new Error(`Unknown user tool: ${name}`);
  }
}
