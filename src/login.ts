import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { isHomeExchangeHostname } from './security';

const defaultSessionPath = path.resolve(__dirname, '../session.json');

interface SessionCookie {
  name: string;
  value: string;
  domain: string;
}

interface RequestLike {
  headers(): Record<string, string | undefined>;
  url(): string;
}

interface PageLike {
  goto(url: string): Promise<unknown>;
  on(event: 'request', listener: (request: RequestLike) => void): void;
}

interface ContextLike {
  cookies(): Promise<SessionCookie[]>;
  newPage(): Promise<PageLike>;
}

interface BrowserLike {
  close(): Promise<void>;
  isConnected(): boolean;
  newContext(options: { viewport: { height: number; width: number } }): Promise<ContextLike>;
  on(event: 'disconnected', listener: () => void): void;
}

export interface LoginOptions {
  launchBrowser?: () => Promise<BrowserLike>;
  log?: (message: string) => void;
  sessionPath?: string;
  waitForSave?: (save: () => Promise<void>) => Promise<void>;
}

export function getUserId(url: URL): string | null {
  return /\/(?:users|members)\/(\d+)/.exec(url.pathname)?.[1] ?? null;
}

export async function login({
  launchBrowser = () => chromium.launch({ headless: false }),
  log = console.log,
  sessionPath = defaultSessionPath,
  waitForSave,
}: LoginOptions = {}): Promise<void> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let token: string | null = null;
  let userId: string | null = null;
  let cookies: SessionCookie[] = [];
  let saving = false;
  let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

  const refreshCookies = async (): Promise<void> => {
    try {
      cookies = (await context.cookies())
        .filter((cookie) => isHomeExchangeHostname(cookie.domain))
        .map(({ name, value, domain }) => ({ name, value, domain }));
    } catch {
      // The browser may already be closed. Keep the most recently captured cookies.
    }
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    saving = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    await refreshCookies();
    fs.writeFileSync(sessionPath, JSON.stringify({ token, cookies, userId }, null, 2));
    log(`Session saved locally with ${cookies.length} trusted HomeExchange cookies.`);
    if (browser.isConnected()) await browser.close();
    process.stdin.pause();
  };

  const scheduleAutoSave = async (): Promise<void> => {
    if (saving || autoSaveTimer || !userId) return;
    await refreshCookies();
    if (cookies.length === 0) return;
    log('Signed-in session detected. Saving the local session...');
    autoSaveTimer = setTimeout(() => { void save(); }, 1_000);
  };

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!isHomeExchangeHostname(url.hostname)) return;

    const authorization = request.headers().authorization;
    if (authorization && authorization !== 'Bearer undefined' && !token) {
      token = authorization;
      void scheduleAutoSave();
    }

    userId ??= getUserId(url);
    void scheduleAutoSave();
  });
  browser.on('disconnected', () => { void save(); });

  log('HomeExchange login opened. Log in, then press Enter to save the local session.');
  await page.goto('https://www.homeexchange.com');
  await refreshCookies();
  const cookieRefresh = setInterval(() => { void refreshCookies(); }, 1_000);

  try {
    if (waitForSave) {
      await waitForSave(save);
    } else {
      process.stdin.resume();
      await new Promise<void>((resolve) => {
        process.stdin.once('data', () => { void save().finally(resolve); });
      });
    }
  } finally {
    clearInterval(cookieRefresh);
  }
}

if (require.main === module) {
  login().catch(console.error);
}
