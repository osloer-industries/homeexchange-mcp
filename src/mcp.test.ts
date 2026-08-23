import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toolMocks = vi.hoisted(() => ({
  handleSearch: vi.fn(),
  handleMessaging: vi.fn(),
  handleUser: vi.fn(),
}));

vi.mock('./tools/search', () => ({
  searchTools: [{ name: 'search', description: 'Search', inputSchema: { type: 'object' } }],
  handleSearch: toolMocks.handleSearch,
}));
vi.mock('./tools/messaging', () => ({
  messagingTools: [{ name: 'message', description: 'Message', inputSchema: { type: 'object' } }],
  handleMessaging: toolMocks.handleMessaging,
}));
vi.mock('./tools/user', () => ({
  userTools: [{ name: 'user', description: 'User', inputSchema: { type: 'object' } }],
  handleUser: toolMocks.handleUser,
}));

import {
  allTools,
  createServer,
  handleToolCall,
  listTools,
  main,
  reportFatal,
} from './mcp';

describe('MCP server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolMocks.handleSearch.mockResolvedValue({ source: 'search' });
    toolMocks.handleMessaging.mockResolvedValue({ source: 'messaging' });
    toolMocks.handleUser.mockResolvedValue({ source: 'user' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists tools from every category', () => {
    expect(allTools.map((tool) => tool.name)).toEqual(['search', 'message', 'user']);
    expect(listTools()).toEqual({ tools: allTools });
  });

  it.each([
    ['search', 'handleSearch', 'search'],
    ['message', 'handleMessaging', 'messaging'],
    ['user', 'handleUser', 'user'],
  ] as const)('dispatches %s tools through %s', async (name, handler, source) => {
    const args = { value: 1 };

    await expect(handleToolCall(name, args)).resolves.toEqual({
      content: [{ type: 'text', text: JSON.stringify({ source }, null, 2) }],
    });
    expect(toolMocks[handler]).toHaveBeenCalledWith(name, args);
  });

  it('returns MCP errors for unknown tools', async () => {
    await expect(handleToolCall('unknown')).resolves.toEqual({
      content: [{ type: 'text', text: 'Error: Unknown tool: unknown' }],
      isError: true,
    });
  });

  it('normalizes non-Error failures from handlers', async () => {
    toolMocks.handleSearch.mockRejectedValueOnce('offline');

    await expect(handleToolCall('search')).resolves.toEqual({
      content: [{ type: 'text', text: 'Error: offline' }],
      isError: true,
    });
  });

  it('creates an MCP server with registered handlers', () => {
    expect(createServer()).toBeInstanceOf(Server);
  });

  it('connects the server to its transport', async () => {
    const server = createServer();
    const connect = vi.spyOn(server, 'connect').mockResolvedValue();
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const transport = {} as Parameters<typeof main>[1];

    await main(server, transport);

    expect(connect).toHaveBeenCalledWith(transport);
    expect(write).toHaveBeenCalledWith('HomeExchange MCP server running (stdio)\n');
  });

  it('reports fatal startup errors and exits', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process exited');
    }) as typeof process.exit);

    expect(() => reportFatal(new Error('broken'))).toThrow('process exited');

    expect(write).toHaveBeenCalledWith('Fatal: Error: broken\n');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
