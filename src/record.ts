import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { isHomeExchangeApiUrl } from './security';

const sessionPath = path.resolve(__dirname, '../session.json');

let browser: Browser | null = null;
let ctx: BrowserContext | null = null;
let userId: string | null = null;
const capturedHeaders: Record<string, string> = {};

process.on('SIGINT', () => { void saveAndExit(); });
process.on('SIGTERM', () => { void saveAndExit(); });

async function saveAndExit() {
  const cookies = ctx ? await ctx.cookies() : [];
  const session = { cookies, headers: capturedHeaders, userId };
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  console.log(`\n✅ Session saved to session.json`);
  console.log(`   Cookies: ${cookies.length}`);
  console.log(`   Headers: ${Object.keys(capturedHeaders).join(', ') || 'none'}`);
  console.log(`   User ID: ${userId}`);
  console.log('   Run: npm run analyze\n');
  browser?.close().finally(() => process.exit(0));
}

async function record() {
  browser = await chromium.launch({ headless: false });
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('request', (req) => {
    const url = new URL(req.url());
    const isApi = isHomeExchangeApiUrl(url);

    if (isApi) {
      // Capture any interesting auth headers
      const headers = req.headers();
      for (const key of ['authorization', 'x-auth-token', 'x-access-token', 'x-api-key']) {
        const val = headers[key];
        if (val && val !== 'Bearer undefined') {
          capturedHeaders[key] = val;
          console.log(`\n🔑 Header captured: ${key}`);
        }
      }

      // Extract user ID from URLs like /users/3778496
      if (!userId) {
        const match = url.pathname.match(/\/(?:users|members)\/(\d+)/);
        if (match) userId = match[1] ?? null;
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
    browser!.on('disconnected', () => resolve());
  });

  saveAndExit();
}

record().catch(console.error);
