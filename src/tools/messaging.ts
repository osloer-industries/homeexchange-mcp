import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { api } from '../api';
import { type Args } from './args';
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

const conversationIdArgs = z.object({ conversation_id: z.string().min(1) });
const listConversationsArgs = z.object({
  after: z.string().min(1).optional(),
  filter: z.enum(['ALL', 'UNANSWERED', 'ARCHIVED']).default('ALL'),
  limit: z.number().int().positive().default(20),
});
const sendMessageArgs = conversationIdArgs.extend({ text: z.string().min(1) });
const startConversationArgs = z.object({ home_id: z.string().min(1), text: z.string().min(1) });

export async function handleMessaging(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'list_conversations': {
      const { after, filter, limit } = listConversationsArgs.parse(args);
      const params: Record<string, string> = { filter, first: String(limit) };
      if (after) params['after'] = after;
      return api.bff('/v3/conversations/me', params);
    }

    case 'get_conversation': {
      const { conversation_id } = conversationIdArgs.parse(args);
      return api.bff(`/v3/conversations/me/${conversation_id}`);
    }

    case 'pre_approve_exchange': {
      const { conversation_id } = conversationIdArgs.parse(args);
      return api.bffPatch(`/exchange/${conversation_id}/pre-approve`);
    }

    case 'archive_conversation': {
      const { conversation_id } = conversationIdArgs.parse(args);
      return api.bffPatch(`/v1/conversations/${conversation_id}/archive`);
    }

    case 'get_exchange_request': {
      const { conversation_id } = conversationIdArgs.parse(args);
      return api.bff(`/exchange/v2/${conversation_id}`);
    }

    case 'get_messages': {
      const { conversation_id } = conversationIdArgs.parse(args);
      return api.bff('/v3/messages', { conversation_id });
    }

    case 'send_message': {
      const { conversation_id, text } = sendMessageArgs.parse(args);
      return api.bffPost('/v1/messages', {
        content: text,
        conversation: Number(conversation_id),
      });
    }

    case 'start_conversation': {
      const { home_id, text } = startConversationArgs.parse(args);
      return api.bffPost('/v3/conversations', {
        homeId: home_id,
        message: { text },
      });
    }

    default:
      throw new Error(`Unknown messaging tool: ${name}`);
  }
}
