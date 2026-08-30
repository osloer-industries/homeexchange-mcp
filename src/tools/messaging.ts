import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';
import { optionalNumber, optionalString, requiredString, type Args } from './args';
import { requiredStringTool } from './tool-schema';

export const messagingTools: Tool[] = [
  {
    name: 'list_conversations',
    description: 'List your HomeExchange conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['ALL', 'UNANSWERED', 'ARCHIVED'],
          description: 'Filter conversations (default ALL)',
        },
        limit: { type: 'number', description: 'Number to return (default 20)' },
        after: { type: 'string', description: 'Pagination cursor (from previous response)' },
      },
    },
  },
  requiredStringTool(
    'get_conversation',
    'Get extended information about a conversation.',
    { conversation_id: 'Conversation ID' }
  ),
  requiredStringTool(
    'send_message',
    'Send a message in an existing conversation.',
    { conversation_id: 'Conversation ID', text: 'Message text to send' }
  ),
  requiredStringTool(
    'get_exchange_request',
    'Get exchange request details for a conversation.',
    { conversation_id: 'Conversation ID' }
  ),
  requiredStringTool(
    'get_messages',
    'Get all messages of a conversation.',
    { conversation_id: 'Conversation ID' }
  ),
  requiredStringTool(
    'pre_approve_exchange',
    'Pre-approve an exchange request.',
    { conversation_id: 'Conversation ID' }
  ),
  requiredStringTool(
    'archive_conversation',
    'Archive a conversation.',
    { conversation_id: 'Conversation ID' }
  ),
  requiredStringTool(
    'start_conversation',
    'Start a new conversation with a member about their home.',
    { home_id: 'The home you are enquiring about', text: 'Opening message' }
  ),
];

export async function handleMessaging(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'list_conversations': {
      const filter = optionalString(args, 'filter') ?? 'ALL';
      const limit = optionalNumber(args, 'limit') ?? 20;
      const params: Record<string, string> = { filter, first: String(limit) };
      const after = optionalString(args, 'after');
      if (after) params['after'] = after;
      return api.bff('/v3/conversations/me', params);
    }

    case 'get_conversation':
      return api.bff(`/v3/conversations/me/${requiredString(args, 'conversation_id')}`);

    case 'pre_approve_exchange':
      return api.bffPatch(`/exchange/${requiredString(args, 'conversation_id')}/pre-approve`);

    case 'archive_conversation':
      return api.bffPatch(`/v1/conversations/${requiredString(args, 'conversation_id')}/archive`);

    case 'get_exchange_request':
      return api.bff(`/exchange/v2/${requiredString(args, 'conversation_id')}`);

    case 'get_messages':
      return api.bff('/v3/messages', { conversation_id: requiredString(args, 'conversation_id') });

    case 'send_message':
      return api.bffPost('/v1/messages', {
        content: args['text'],
        conversation: Number(args['conversation_id']),
      });

    case 'start_conversation':
      return api.bffPost('/v3/conversations', {
        homeId: args['home_id'],
        message: { text: args['text'] },
      });

    default:
      throw new Error(`Unknown messaging tool: ${name}`);
  }
}
