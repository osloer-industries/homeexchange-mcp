import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { api } from '../api';
import { zodTool } from './zod-tool';

export type ToolArgs = Record<string, unknown>;
export { api, z, zodTool, type Tool };