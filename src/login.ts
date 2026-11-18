export { getUserId, login, type LoginOptions } from './adapters/browser/login';

import { login as runLogin } from './adapters/browser/login';
import { runAsMain } from './run-as-main';

runAsMain(module, runLogin);
