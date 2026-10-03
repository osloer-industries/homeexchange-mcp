export {
  allTools,
  createServer,
  handleToolCall,
  listTools,
  main,
  reportFatal,
} from './adapters/mcp/server';

import { main, reportFatal } from './adapters/mcp/server';

if (require.main === module) {
  main().catch(reportFatal);
}
