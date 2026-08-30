import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type ZodObject, type ZodRawShape } from 'zod/v3';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodTool<T extends ZodRawShape>(name: string, description: string, schema: ZodObject<T>): Tool {
  const inputSchema = zodToJsonSchema(schema, { $refStrategy: 'none' });
  if (!isMcpInputSchema(inputSchema)) throw new Error('MCP tool schemas must be objects');
  return { name, description, inputSchema };
}

function isMcpInputSchema(value: unknown): value is Tool['inputSchema'] {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'object';
}
