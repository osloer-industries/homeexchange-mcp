import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';
import { requiredStringTool } from './tool-schema';

export const userTools: Tool[] = [
  requiredStringTool(
    'get_user_profile',
    "Get a member's public profile on HomeExchange.",
    { user_id: 'Numeric user ID' }
  ),
  requiredStringTool(
    'get_user_achievements',
    'Get achievements for a HomeExchange member.',
    { user_id: 'Numeric user ID' }
  ),
  requiredStringTool(
    'get_user_ratings',
    'Get ratings left for a HomeExchange member.',
    { user_id: 'Numeric user ID' }
  ),
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
