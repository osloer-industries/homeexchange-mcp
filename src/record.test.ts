import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { getRequestSummary, getResponseSummary, record } from './record';

describe('record summaries', () => {
  it('keeps API paths but drops query strings and non-API hosts', () => {
    expect(getRequestSummary({
      headers: () => ({}), method: () => 'GET', url: () => 'https://api.homeexchange.com/v1/search?member=private',
    })).toBe('GET /v1/search');
    expect(getRequestSummary({
      headers: () => ({}), method: () => 'GET', url: () => 'https://www.homeexchange.com/profile/1',
    })).toBeNull();
    expect(getResponseSummary({
      request: () => ({ url: () => 'https://bff.homeexchange.com/api/me?token=secret' }), status: () => 200,
    })).toBe('200 /api/me');
  });
});

describe('record', () => {
  it('stores captured credentials locally without exposing them in logs', async () => {
    let requestListener: ((request: { headers: () => Record<string, string>; method: () => string; url: () => string }) => void) | undefined;
    let responseListener: ((response: { request: () => { url: () => string }; status: () => number }) => void) | undefined;
    let disconnected: (() => void) | undefined;
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const page = {
      goto: vi.fn<(url: string) => Promise<void>>().mockImplementation(async () => {
        requestListener?.({
          headers: () => ({ authorization: 'Bearer local-secret' }),
          method: () => 'POST',
          url: () => 'https://api.homeexchange.com/api/users/123?member=private',
        });
        responseListener?.({
          request: () => ({ url: () => 'https://api.homeexchange.com/api/users/123?member=private' }),
          status: () => 201,
        });
      }),
      on: (event: 'request' | 'response', listener: typeof requestListener | typeof responseListener) => {
        if (event === 'request') requestListener = listener as typeof requestListener;
        else responseListener = listener as typeof responseListener;
      },
    };
    const context = {
      cookies: vi.fn<() => Promise<{ name: string }[]>>().mockResolvedValue([{ name: 'session' }]),
      newPage: vi.fn<() => Promise<typeof page>>().mockResolvedValue(page),
    };
    const browser = {
      close,
      isConnected: () => true,
      newContext: vi.fn<() => Promise<typeof context>>().mockResolvedValue(context),
      on: (_event: 'disconnected', listener: () => void) => { disconnected = listener; },
    };
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'homeexchange-record-'));
    const sessionPath = path.join(directory, 'session.json');
    const log = vi.fn<(message: string) => void>();

    try {
      await record({
        launchBrowser: async () => browser,
        log,
        sessionPath,
        waitForCompletion: async () => { disconnected?.(); },
      });

      expect(JSON.parse(fs.readFileSync(sessionPath, 'utf8'))).toEqual({
        cookies: [{ name: 'session' }],
        headers: { authorization: 'Bearer local-secret' },
        userId: '123',
      });
      expect(log.mock.calls.flat().join(' ')).not.toContain('local-secret');
      expect(log.mock.calls.flat().join(' ')).not.toContain('member=private');
      expect(close).toHaveBeenCalledOnce();
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
