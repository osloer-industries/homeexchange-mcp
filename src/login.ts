import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

async function login() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let token: string | null = null;
  let userId: string | null = null;

  console.log('\n🔐 HomeExchange Login\n');
  console.log('   Log in to your account, then press Ctrl+C (or close the browser).\n');

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== 'homeexchange.com' && !url.hostname.endsWith('.homeexchange.com')) return;

    const auth = req.headers()['authorization'];
    if (auth && auth !== 'Bearer undefined' && !token) {
      token = auth;
      console.log('✅ Auth token captured.');
    }

    if (!userId) {
      const match = url.pathname.match(/\/(?:users|members)\/(\d+)/);
      if (match?.[1]) {
        userId = match[1];
        console.log(`✅ User ID: ${userId}`);
      }
    }
  });

  const save = async () => {
    const cookies = await ctx.cookies();
    const session = { token, cookies, userId };
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
    console.log(`\n💾 Session saved to session.json`);
    console.log(`   Token:   ${token ? token.slice(0, 40) + '...' : 'none'}`);
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User ID: ${userId ?? 'unknown'}`);
    console.log('\n   Run: npm run mcp\n');
    await browser.close();
    process.exit(0);
  };

  process.on('SIGINT', () => { void save(); });
  browser.on('disconnected', () => { void save(); });

  await page.goto('https://www.homeexchange.com');
  await new Promise<void>(() => {}); // keep alive until signal
}

login().catch(console.error);
