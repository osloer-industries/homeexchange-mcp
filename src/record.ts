import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const sessionPath = path.resolve(__dirname, '../session.json');

let browser: Browser | null = null;
let ctx: BrowserContext | null = null;
let userId: string | null = null;
const capturedHeaders: Record<string, string> = {};

// Store captured request/response bodies for search calls
const capturedBodies: Array<{ method: string; url: string; reqBody?: string; resStatus: number; resBody?: string }> = [];

process.on('SIGINT', () => { void saveAndExit(); });
process.on('SIGTERM', () => { void saveAndExit(); });

async function saveAndExit() {
  const cookies = ctx ? await ctx.cookies() : [];
  const session = { cookies, headers: capturedHeaders, userId };
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

  // Also save captured bodies to a separate file for analysis
  const bodiesPath = path.resolve(__dirname, '../captured-requests.json');
  fs.writeFileSync(bodiesPath, JSON.stringify(capturedBodies, null, 2));

  console.log(`\n✅ Session saved to session.json`);
  console.log(`   Cookies: ${cookies.length}`);
  console.log(`   Headers: ${Object.keys(capturedHeaders).join(', ') || 'none'}`);
  console.log(`   User ID: ${userId}`);
  console.log(`\n📡 Captured ${capturedBodies.length} search/API bodies → captured-requests.json`);
  console.log('   Run: npm run analyze\n');
  browser?.close().finally(() => process.exit(0));
}

async function record() {
  browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('request', (req) => {
    const url = req.url();
    const isApi = url.includes('api.homeexchange.com') || url.includes('bff.homeexchange.com');

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
        const match = url.match(/\/(?:users|members)\/(\d+)/);
        if (match) userId = match[1] ?? null;
      }

      const method = req.method();
      const postBody = req.postData();
      console.log(`→ ${method} ${url}`);
      if (postBody) {
        console.log(`  BODY: ${postBody}`);
      }
    }
  });

  page.on('response', async (res) => {
    const url = res.request().url();
    const isApi = url.includes('api.homeexchange.com') || url.includes('bff.homeexchange.com');
    if (!isApi) return;

    const status = res.status();
    console.log(`← ${status} ${url}`);

    // Capture body for search endpoints and errors
    const isSearch = url.includes('/search') || url.includes('/homes');
    const isError = status >= 400;
    if (isSearch || isError) {
      try {
        const body = await res.text();
        console.log(`  RESPONSE (${status}): ${body.slice(0, 500)}`);
        capturedBodies.push({
          method: res.request().method(),
          url,
          reqBody: res.request().postData() ?? undefined,
          resStatus: status,
          resBody: body,
        });
      } catch { /* ignore */ }
    }
  });

  await page.goto('https://www.homeexchange.com');

  console.log('\n✅ Browser open. Interact with the site:');
  console.log('   1. Log in (ou naviguez directement si déjà connecté)');
  console.log('   2. Faites une recherche (ex: Bruxelles, août 2026, 4 personnes)');
  console.log('   3. Les requêtes POST /search/homes seront capturées automatiquement');
  console.log('\nPress Ctrl+C when done.\n');

  await new Promise<void>((resolve) => {
    browser!.on('disconnected', () => resolve());
  });

  saveAndExit();
}

record().catch(console.error);
