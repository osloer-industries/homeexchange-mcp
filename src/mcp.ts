import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchTools, handleSearch } from './tools/search';
import { messagingTools, handleMessaging } from './tools/messaging';
import { userTools, handleUser } from './tools/user';

const ALL_TOOLS = [...searchTools, ...messagingTools, ...userTools];
const SEARCH_NAMES = new Set(searchTools.map((t) => t.name));
const MESSAGING_NAMES = new Set(messagingTools.map((t) => t.name));
const USER_NAMES = new Set(userTools.map((t) => t.name));

const server = new Server(
  { name: 'homeexchange', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    let result: unknown;

    if (SEARCH_NAMES.has(name)) {
      result = await handleSearch(name, args as Record<string, unknown>);
    } else if (MESSAGING_NAMES.has(name)) {
      result = await handleMessaging(name, args as Record<string, unknown>);
    } else if (USER_NAMES.has(name)) {
      result = await handleUser(name, args as Record<string, unknown>);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('HomeExchange MCP server running (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
});
