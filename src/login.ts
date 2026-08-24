import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { isHomeExchangeHostname } from './security';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

interface SessionCookie {
  name: string;
  value: string;
  domain: string;
}

async function login() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let token: string | null = null;
  let userId: string | null = null;
  let cookies: SessionCookie[] = [];
  let saving = false;
  let complete: (() => void) | undefined;
  let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

  console.log('\n🔐 HomeExchange Login\n');
  console.log('   Log in to your account. Your session is saved automatically once sign-in is detected.\n');
  console.log('   If it is not saved automatically, return here and press Enter or Ctrl+C.\n');

  const refreshCookies = async () => {
    try {
      cookies = (await ctx.cookies())
        .filter((cookie) => isHomeExchangeHostname(cookie.domain))
        .map(({ name, value, domain }) => ({ name, value, domain }));
    } catch {
      // The browser may already be closed. Keep the most recently captured cookies.
    }
  };

  const save = async () => {
    if (saving) return;
    saving = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    await refreshCookies();

    const session = { token, cookies, userId };
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
    console.log('\n💾 Session saved to session.json');
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User ID: ${userId ?? 'unknown'}`);
    console.log('\n   Run: npm run mcp\n');

    if (browser.isConnected()) await browser.close();
    process.stdin.pause();
    complete?.();
  };

  const scheduleAutoSave = async () => {
    if (saving || autoSaveTimer || !userId) return;
    await refreshCookies();
    if (cookies.length === 0) return;

    console.log('✅ Signed-in session detected. Saving local session...');
    autoSaveTimer = setTimeout(() => { void save(); }, 1_000);
  };

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!isHomeExchangeHostname(url.hostname)) return;

    const auth = req.headers()['authorization'];
    if (auth && auth !== 'Bearer undefined' && !token) {
      token = auth;
      console.log('✅ Auth token captured.');
      void scheduleAutoSave();
    }

    if (!userId) {
      const match = /\/(?:users|members)\/(\d+)/.exec(url.pathname);
      if (match?.[1]) {
        userId = match[1];
        console.log(`✅ User ID: ${userId}`);
        void scheduleAutoSave();
      }
    }
  });

  process.on('SIGINT', () => { void save(); });
  browser.on('disconnected', () => { void save(); });

  await page.goto('https://www.homeexchange.com');
  await refreshCookies();
  const cookieRefresh = setInterval(() => { void refreshCookies(); }, 1_000);

  process.stdin.resume();
  process.stdin.once('data', () => { void save(); });
  await new Promise<void>((resolve) => { complete = resolve; });
  clearInterval(cookieRefresh);
}

login().catch(console.error);
