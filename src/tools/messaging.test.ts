import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessaging, messagingTools } from './messaging';

const apiMock = vi.hoisted(() => ({
  bff: vi.fn(),
  bffPatch: vi.fn(),
  bffPost: vi.fn(),
}));

vi.mock('../api', () => ({ api: apiMock }));

describe('messaging tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.bff.mockResolvedValue({ ok: true });
    apiMock.bffPatch.mockResolvedValue({ ok: true });
    apiMock.bffPost.mockResolvedValue({ ok: true });
  });

  it('defines all messaging tools with their required string fields', () => {
    expect(messagingTools.map((tool) => tool.name)).toEqual([
      'list_conversations',
      'get_conversation',
      'send_message',
      'get_exchange_request',
      'get_messages',
      'pre_approve_exchange',
      'archive_conversation',
      'start_conversation',
    ]);
    expect(messagingTools.find((tool) => tool.name === 'send_message')?.inputSchema.required)
      .toEqual(['conversation_id', 'text']);
  });

  it('lists conversations with defaults and an optional cursor', async () => {
    await handleMessaging('list_conversations', {});
    await handleMessaging('list_conversations', {
      filter: 'UNANSWERED',
      limit: 5,
      after: 'next-page',
    });

    expect(apiMock.bff).toHaveBeenNthCalledWith(
      1,
      '/v3/conversations/me',
      { filter: 'ALL', first: '20' }
    );
    expect(apiMock.bff).toHaveBeenNthCalledWith(
      2,
      '/v3/conversations/me',
      { filter: 'UNANSWERED', first: '5', after: 'next-page' }
    );
  });

  it('gets conversation, exchange, and message details', async () => {
    await handleMessaging('get_conversation', { conversation_id: '123' });
    await handleMessaging('get_exchange_request', { conversation_id: '123' });
    await handleMessaging('get_messages', { conversation_id: '123' });

    expect(apiMock.bff).toHaveBeenNthCalledWith(1, '/v3/conversations/me/123');
    expect(apiMock.bff).toHaveBeenNthCalledWith(2, '/exchange/v2/123');
    expect(apiMock.bff).toHaveBeenNthCalledWith(
      3,
      '/v3/messages',
      { conversation_id: '123' }
    );
  });

  it('pre-approves and archives conversations', async () => {
    await handleMessaging('pre_approve_exchange', { conversation_id: '123' });
    await handleMessaging('archive_conversation', { conversation_id: '123' });

    expect(apiMock.bffPatch).toHaveBeenNthCalledWith(1, '/exchange/123/pre-approve');
    expect(apiMock.bffPatch).toHaveBeenNthCalledWith(2, '/v1/conversations/123/archive');
  });

  it('sends messages to existing and new conversations', async () => {
    await handleMessaging('send_message', { conversation_id: '123', text: 'Hello' });
    await handleMessaging('start_conversation', { home_id: '456', text: 'Hi' });

    expect(apiMock.bffPost).toHaveBeenNthCalledWith(1, '/v1/messages', {
      content: 'Hello',
      conversation: 123,
    });
    expect(apiMock.bffPost).toHaveBeenNthCalledWith(2, '/v3/conversations', {
      homeId: '456',
      message: { text: 'Hi' },
    });
  });

  it('rejects unknown messaging tools', async () => {
    await expect(handleMessaging('unknown', {})).rejects.toThrow(
      'Unknown messaging tool: unknown'
    );
  });
});
