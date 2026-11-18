import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { type Browser, type LoginPage, type SessionCookie } from '../../application/ports/browser';
import { isHomeExchangeHostname } from '../../security';
import { defaultSessionPath, interactiveContextInit, launchInteractiveBrowser } from './interactive-session';
import { claimExclusiveSave, closeBrowserWhenConnected, writeSessionJson } from './session-json';

export interface LoginOptions {
  launchBrowser?: () => Promise<Browser<LoginPage, SessionCookie>>;
  log?: (message: string) => void;
  sessionPath?: string;
  waitForSave?: (save: () => Promise<void>) => Promise<void>;
}

export function getUserId(url: URL): string | null {
  return /\/(?:users|members)\/(\d+)/.exec(url.pathname)?.[1] ?? null;
}

export async function login({
  launchBrowser = launchInteractiveBrowser,
  log = console.log,
  sessionPath = defaultSessionPath,
  waitForSave,
}: LoginOptions = {}): Promise<void> {
  const browser = await launchBrowser();
  const context = await browser.newContext(interactiveContextInit());
  const page = await context.newPage();
  let token: string | null = null;
  let userId: string | null = null;
  let cookies: SessionCookie[] = [];
  const saving = { active: false };
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
    if (!claimExclusiveSave(saving)) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    await refreshCookies();
    writeSessionJson(sessionPath, { token, cookies, userId });
    log(`Session saved locally with ${cookies.length} trusted HomeExchange cookies.`);
    await closeBrowserWhenConnected(browser);
    process.stdin.pause();
  };

  const scheduleAutoSave = async (): Promise<void> => {
    if (saving.active || autoSaveTimer || !userId) return;
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
