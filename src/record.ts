export {
  createRecorderPage,
  getRequestSummary,
  getResponseSummary,
  record,
  type RecordOptions,
  type RecorderPage,
} from './adapters/browser/record';

import { record } from './adapters/browser/record';
import { runAsMain } from './run-as-main';

runAsMain(module, record);
