import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { isHomeExchangeApiUrl, userIdFromPathname } from './security';

export interface RecordState {
  browser: Browser | null;
  ctx: BrowserContext | null;
  userId: string | null;
  capturedHeaders: Record<string, string>;
  sessionPath: string;
}

export const recordState: RecordState = {
  browser: null,
  ctx: null,
  userId: null,
  capturedHeaders: {},
  sessionPath: path.resolve(__dirname, '../session.json'),
};

function reportRecordError(err: unknown): void {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

function onRecordSignal(): void {
  void saveAndExit().catch(reportRecordError);
}

process.on('SIGINT', onRecordSignal);
process.on('SIGTERM', onRecordSignal);

export async function saveAndExit(state: RecordState = recordState): Promise<void> {
  const cookies = state.ctx ? await state.ctx.cookies() : [];
  const session = {
    cookies,
    headers: state.capturedHeaders,
    userId: state.userId,
  };
  fs.writeFileSync(state.sessionPath, JSON.stringify(session, null, 2));
  console.log(`\n✅ Session saved to session.json`);
  console.log(`   Cookies: ${cookies.length}`);
  console.log(`   Headers: ${Object.keys(state.capturedHeaders).join(', ') || 'none'}`);
  console.log(`   User ID: ${state.userId}`);
  console.log('   Run: npm run analyze\n');
  if (state.browser) {
    await state.browser.close();
  }
  process.exit(0);
}

async function record() {
  recordState.browser = await chromium.launch({ headless: false });
  recordState.ctx = await recordState.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await recordState.ctx.newPage();

  page.on('request', (req) => {
    const url = new URL(req.url());
    const isApi = isHomeExchangeApiUrl(url);

    if (isApi) {
      const headers = req.headers();
      for (const key of ['authorization', 'x-auth-token', 'x-access-token', 'x-api-key']) {
        const val = headers[key];
        if (val && val !== 'Bearer undefined') {
          recordState.capturedHeaders[key] = val;
          console.log(`\n🔑 Header captured: ${key}`);
        }
      }

      if (!recordState.userId) {
        recordState.userId = userIdFromPathname(url.pathname);
      }

      console.log(`→ ${req.method()} ${url.toString()}`);
    }
  });

  page.on('response', (res) => {
    const url = new URL(res.request().url());
    if (isHomeExchangeApiUrl(url)) {
      console.log(`← ${res.status()} ${url.toString()}`);
    }
  });

  await page.goto('https://www.homeexchange.com');

  console.log('\n✅ Browser open. Interact with the site:');
  console.log('   1. Log in');
  console.log('   2. Run a search');
  console.log('   3. Open a member profile');
  console.log('   4. Open/send a message');
  console.log('\nPress Ctrl+C when done.\n');

  await new Promise<void>((resolve) => {
    recordState.browser!.on('disconnected', () => resolve());
  });

  await saveAndExit();
}

if (process.argv[1] === __filename) {
  record().catch(reportRecordError);
}
