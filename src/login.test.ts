import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { getUserId, login } from './login';

describe('getUserId', () => {
  it('extracts member and user identifiers only from supported paths', () => {
    expect(getUserId(new URL('https://www.homeexchange.com/users/123'))).toBe('123');
    expect(getUserId(new URL('https://www.homeexchange.com/members/456'))).toBe('456');
    expect(getUserId(new URL('https://www.homeexchange.com/profile/123'))).toBeNull();
  });
});

describe('login', () => {
  it('stores only trusted cookies after an authenticated HomeExchange request', async () => {
    let requestListener: ((request: { headers: () => Record<string, string>; url: () => string }) => void) | undefined;
    let disconnected: (() => void) | undefined;
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const page = {
      goto: vi.fn<(url: string) => Promise<void>>().mockImplementation(async () => {
        requestListener?.({
          headers: () => ({ authorization: 'Bearer test-token' }),
          url: () => 'https://www.homeexchange.com/api/users/123',
        });
      }),
      on: (_event: 'request', listener: typeof requestListener) => { requestListener = listener; },
    };
    const context = {
      cookies: vi.fn<() => Promise<{ name: string; value: string; domain: string }[]>>().mockResolvedValue([
        { name: 'trusted', value: 'value', domain: '.homeexchange.com' },
        { name: 'other', value: 'value', domain: '.example.com' },
      ]),
      newPage: vi.fn<() => Promise<typeof page>>().mockResolvedValue(page),
    };
    const browser = {
      close,
      isConnected: () => true,
      newContext: vi.fn<() => Promise<typeof context>>().mockResolvedValue(context),
      on: (_event: 'disconnected', listener: () => void) => { disconnected = listener; },
    };
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'homeexchange-login-'));
    const sessionPath = path.join(directory, 'session.json');
    const log = vi.fn<(message: string) => void>();

    try {
      await login({
        launchBrowser: async () => browser,
        log,
        sessionPath,
        waitForSave: async (save) => { await save(); },
      });

      expect(JSON.parse(fs.readFileSync(sessionPath, 'utf8'))).toEqual({
        token: 'Bearer test-token',
        cookies: [{ name: 'trusted', value: 'value', domain: '.homeexchange.com' }],
        userId: '123',
      });
      expect(close).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith('Session saved locally with 1 trusted HomeExchange cookies.');
      disconnected?.();
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
