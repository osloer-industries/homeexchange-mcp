import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { searchTools, handleSearch } from './tools/search';
import { messagingTools, handleMessaging } from './tools/messaging';
import { userTools, handleUser } from './tools/user';

export const allTools = [...searchTools, ...messagingTools, ...userTools];
const SEARCH_NAMES = new Set(searchTools.map((t) => t.name));
const MESSAGING_NAMES = new Set(messagingTools.map((t) => t.name));
const USER_NAMES = new Set(userTools.map((t) => t.name));

function isArgs(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function listTools() {
  return { tools: allTools };
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> = {}
): Promise<CallToolResult> {
  try {
    let result: unknown;

    if (SEARCH_NAMES.has(name)) {
      result = await handleSearch(name, args);
    } else if (MESSAGING_NAMES.has(name)) {
      result = await handleMessaging(name, args);
    } else if (USER_NAMES.has(name)) {
      result = await handleUser(name, args);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
}

export function createServer(): Server {
  const server = new Server(
    { name: 'homeexchange', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => listTools());
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    return handleToolCall(name, isArgs(args) ? args : {});
  });

  return server;
}

export async function main(
  server: Server = createServer(),
  connect: (target: StdioServerTransport) => Promise<void> = (target) => server.connect(target)
) {
  await connect(new StdioServerTransport());
  process.stderr.write('HomeExchange MCP server running (stdio)\n');
}

export function reportFatal(err: unknown): never {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
}

if (process.argv[1] === __filename) {
  main().catch(reportFatal);
}
