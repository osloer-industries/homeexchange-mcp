import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { searchTools, handleSearch } from '../../tools/search';
import { messagingTools, handleMessaging } from '../../tools/messaging';
import { userTools, handleUser } from '../../tools/user';

export const allTools = [...searchTools, ...messagingTools, ...userTools];
const SEARCH_NAMES = new Set(searchTools.map((t) => t.name));
const MESSAGING_NAMES = new Set(messagingTools.map((t) => t.name));
const USER_NAMES = new Set(userTools.map((t) => t.name));

const argsSchema = z.record(z.string(), z.unknown());

export function listTools() {
  return { tools: allTools };
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> = {},
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

function toolHandler(name: string) {
  return async (args: Record<string, unknown>) => {
    const outcome = await handleToolCall(name, argsSchema.parse(args));
    if (outcome.isError) {
      const text = outcome.content[0]?.type === 'text' ? outcome.content[0].text : 'Tool failed';
      throw new Error(text.replace(/^Error: /, ''));
    }
    return outcome;
  };
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'homeexchange', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description ?? tool.name },
      toolHandler(tool.name),
    );
  }

  return server;
}

export async function main(
  server: McpServer = createServer(),
  connect: (target: StdioServerTransport) => Promise<void> = (target) => server.connect(target),
): Promise<void> {
  await connect(new StdioServerTransport());
  process.stderr.write('HomeExchange MCP server running (stdio)\n');
}

export function reportFatal(err: unknown): never {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
}