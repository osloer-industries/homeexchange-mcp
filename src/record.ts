export {
  createRecorderPage,
  getRequestSummary,
  getResponseSummary,
  record,
  type RecordOptions,
  type RecorderPage,
} from './adapters/browser/record';

import { record } from './adapters/browser/record';

if (require.main === module) {
  record().catch(console.error);
}
