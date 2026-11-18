export { getUserId, login, type LoginOptions } from './adapters/browser/login';

import { login as runLogin } from './adapters/browser/login';

if (require.main === module) {
  runLogin().catch(console.error);
}
