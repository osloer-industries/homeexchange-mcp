import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type ZodObject, type ZodRawShape } from 'zod';

export function zodTool<T extends ZodRawShape>(name: string, description: string, schema: ZodObject<T>): Tool {
  const inputSchema = schema.toJSONSchema({ target: 'draft-07' });
  if (!isMcpInputSchema(inputSchema)) throw new Error('MCP tool schemas must be objects');
  return { name, description, inputSchema };
}

function isMcpInputSchema(value: unknown): value is Tool['inputSchema'] {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'object';
}
