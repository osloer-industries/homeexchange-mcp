import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';
import { requiredString, type Args } from './args';
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

export async function handleUser(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'get_user_profile':
      return api.get(`/v1/users/${requiredString(args, 'user_id')}`);

    case 'get_user_achievements':
      return api.get(`/v1/achievement/${requiredString(args, 'user_id')}`);

    case 'get_user_ratings':
      return api.get(`/v1/ratings/${requiredString(args, 'user_id')}`);

    default:
      throw new Error(`Unknown user tool: ${name}`);
  }
}
