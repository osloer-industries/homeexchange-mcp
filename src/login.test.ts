import * as fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getUserId, login } from './login';
import { sessionPathIn, withTempDirectory } from '../test-support/session-directory';

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
      goto: vi.fn<(url: string) => Promise<void>>().mockImplementation(() => {
        requestListener?.({
          headers: () => ({ authorization: 'Bearer test-token' }),
          url: () => 'https://www.homeexchange.com/api/users/123',
        });
        return Promise.resolve();
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
    const log = vi.fn<(message: string) => void>();

    await withTempDirectory('homeexchange-login-', async (directory) => {
      const sessionPath = sessionPathIn(directory);
      await login({
        launchBrowser: () => Promise.resolve(browser),
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
    });
  });

  it('safely saves when cookie refresh fails and the browser is already closed', async () => {
    let requestListener: ((request: { headers: () => Record<string, string>; url: () => string }) => void) | undefined;
    const page = {
      goto: (): Promise<void> => {
        requestListener?.({
          headers: () => ({}),
          url: () => 'https://www.homeexchange.com/members/456',
        });
        return Promise.resolve();
      },
      on: (_event: 'request', listener: typeof requestListener): void => { requestListener = listener; },
    };
    const context = {
      cookies: (): Promise<never> => Promise.reject(new Error('browser closed')),
      newPage: (): Promise<typeof page> => Promise.resolve(page),
    };
    const browser = {
      close: (): Promise<void> => Promise.resolve(),
      isConnected: (): boolean => false,
      newContext: (): Promise<typeof context> => Promise.resolve(context),
      on: (): void => undefined,
    };

    await withTempDirectory('homeexchange-login-', async (directory) => {
      await login({
        launchBrowser: () => Promise.resolve(browser),
        log: () => undefined,
        sessionPath: sessionPathIn(directory),
        waitForSave: async (save) => { await Promise.resolve(); await save(); await save(); },
      });
      expect(JSON.parse(fs.readFileSync(sessionPathIn(directory), 'utf8'))).toEqual({
        token: null,
        cookies: [],
        userId: '456',
      });
    });
  });
});