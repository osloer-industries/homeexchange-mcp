export { getUserId, login, type LoginOptions } from './adapters/browser/login';

import { login } from './adapters/browser/login';

if (require.main === module) {
  login().catch(console.error);
}
