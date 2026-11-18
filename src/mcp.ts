export {
  allTools,
  createServer,
  handleToolCall,
  listTools,
  main,
  reportFatal,
} from './adapters/mcp/server';

import { main, reportFatal } from './adapters/mcp/server';
import { runAsMain } from './run-as-main';

runAsMain(module, main, reportFatal);
