import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';

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
  {
    name: 'get_conversation',
    description: 'Get extended information about a conversation.',
    inputSchema: {
      type: 'object',
      required: ['conversation_id'],
      properties: {
        conversation_id: { type: 'string', description: 'Conversation ID' },
      },
    },
  },
  {
    name: 'send_message',
    description: 'Send a message in an existing conversation.',
    inputSchema: {
      type: 'object',
      required: ['conversation_id', 'text'],
      properties: {
        conversation_id: { type: 'string', description: 'Conversation ID' },
        text: { type: 'string', description: 'Message text to send' },
      },
    },
  },
  {
    name: 'get_messages',
    description: 'Get all messages of a conversation.',
    inputSchema: {
      type: 'object',
      required: ['conversation_id'],
      properties: {
        conversation_id: { type: 'string', description: 'Conversation ID' },
      },
    },
  },
  {
    name: 'start_conversation',
    description: 'Start a new conversation with a member about their home.',
    inputSchema: {
      type: 'object',
      required: ['home_id', 'text'],
      properties: {
        home_id: { type: 'string', description: 'The home you are enquiring about' },
        text: { type: 'string', description: 'Opening message' },
      },
    },
  },
];

type Args = Record<string, unknown>;

export async function handleMessaging(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'list_conversations': {
      const filter = (args['filter'] as string | undefined) ?? 'ALL';
      const limit = (args['limit'] as number | undefined) ?? 20;
      const params: Record<string, string> = { filter, first: String(limit) };
      if (args['after'] !== undefined) params['after'] = args['after'] as string;
      return api.bff('/v3/conversations/me', params);
    }

    case 'get_conversation':
      return api.bff(`/v3/conversations/me/${args['conversation_id'] as string}`);

    case 'get_messages':
      return api.bff('/v3/messages', { conversation_id: args['conversation_id'] as string });

    case 'send_message':
      return api.bffPost(
        `/v3/conversations/${args['conversation_id'] as string}/messages`,
        { text: args['text'] }
      );

    case 'start_conversation':
      return api.bffPost('/v3/conversations', {
        homeId: args['home_id'],
        message: { text: args['text'] },
      });

    default:
      throw new Error(`Unknown messaging tool: ${name}`);
  }
}
