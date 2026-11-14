import { type Tool } from '@modelcontextprotocol/sdk/types.js';

export function emptyInputTool(name: string, description: string): Tool {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties: {} },
  };
}

export function optionalLimitTool(name: string, description: string, limitDescription: string): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: limitDescription },
      },
    },
  };
}

export function requiredStringTool(
  name: string,
  description: string,
  fields: Record<string, string>
): Tool {
  const required = Object.keys(fields);
  const properties = Object.fromEntries(
    Object.entries(fields).map(([field, fieldDescription]) => [
      field,
      { type: 'string', description: fieldDescription },
    ])
  );

  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      required,
      properties,
    },
  };
}
