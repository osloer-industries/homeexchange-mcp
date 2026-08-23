import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const { existsMock, fetchMock, sessionState } = vi.hoisted(() => ({
  existsMock: vi.fn(() => true),
  fetchMock: vi.fn(),
  sessionState: {
    json: JSON.stringify({
      token: 'Bearer test-token',
      cookies: [
        { name: 'trusted', value: 'yes', domain: '.homeexchange.com' },
        { name: 'untrusted', value: 'no', domain: 'evilhomeexchange.com' },
      ],
      userId: '123',
    }),
  },
}));

function response(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 500 ? 'Internal Server Error' : '',
    text: vi.fn(async () => body),
  };
}

vi.mock('fs', () => ({
  existsSync: existsMock,
  readFileSync: vi.fn(() => sessionState.json),
}));

vi.stubGlobal('fetch', fetchMock);

describe('api client', () => {
  beforeEach(() => {
    existsMock.mockReset();
    existsMock.mockReturnValue(true);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response(JSON.stringify({ ok: true })));
    sessionState.json = JSON.stringify({
      token: 'Bearer test-token',
      cookies: [
        { name: 'trusted', value: 'yes', domain: '.homeexchange.com' },
        { name: 'untrusted', value: 'no', domain: 'evilhomeexchange.com' },
      ],
      userId: '123',
    });
  });

  it('sends authenticated requests only to the API origin', async () => {
    await expect(api.get('/v1/users/123', { include: 'profile' })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.homeexchange.com/v1/users/123?include=profile');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      Cookie: 'trusted=yes',
    });
  });

  it('supports BFF reads and writes', async () => {
    await api.bff('/v3/conversations/me');
    await api.bff('/v3/conversations/me', { page: '2' });
    await api.bffPost('/v3/conversations', { message: 'hello' }, { locale: 'en' });
    await api.bffPost('/v3/conversations', { message: 'hello again' });

    expect((fetchMock.mock.calls[0]![0] as URL).origin).toBe('https://bff.homeexchange.com');
    expect((fetchMock.mock.calls[1]![0] as URL).search).toBe('?page=2');
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    });
    expect((fetchMock.mock.calls[3]![0] as URL).search).toBe('');
  });

  it('supports BFF PATCH requests with optional bodies and parameters', async () => {
    await api.bffPatch('/exchange/123/pre-approve', { approved: true }, { locale: 'en' });
    await api.bffPatch('/v1/conversations/123/archive');

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(firstUrl.toString()).toBe('https://bff.homeexchange.com/exchange/123/pre-approve?locale=en');
    expect(firstInit).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ approved: true }),
    });
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: 'PATCH' });
    expect(fetchMock.mock.calls[1]![1]).not.toHaveProperty('body');
  });

  it('supports API writes and deletes', async () => {
    await api.post('/v1/messages', { content: 'hello' }, { locale: 'en' });
    await api.del('/v1/messages/123', { source: 'inbox' });

    expect((fetchMock.mock.calls[0]![0] as URL).search).toBe('?locale=en');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
    expect((fetchMock.mock.calls[1]![0] as URL).search).toBe('?source=inbox');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: 'DELETE' });
  });

  it('refuses an endpoint that changes the trusted origin', async () => {
    await expect(api.get('@example.org/private')).rejects.toThrow('Refusing request to untrusted origin');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('omits authorization when the session has no token', async () => {
    sessionState.json = JSON.stringify({ token: null, cookies: [], userId: null });
    vi.resetModules();
    const { api: tokenlessApi } = await import('./api');

    await tokenlessApi.get('/v1/users/me');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('reports a missing local session during module initialization', async () => {
    existsMock.mockReturnValue(false);
    vi.resetModules();

    await expect(import('./api')).rejects.toThrow('No session found');
  });

  it('reports an expired session without exposing the response body', async () => {
    fetchMock.mockResolvedValueOnce(response('private response', 401));

    await expect(api.get('/v1/users/123')).rejects.toThrow('Session expired');
  });

  it('limits error response details', async () => {
    fetchMock.mockResolvedValueOnce(response('x'.repeat(300), 500));

    await expect(api.get('/v1/users/123')).rejects.toThrow(`HTTP 500 Internal Server Error: ${'x'.repeat(200)}`);
  });

  it('handles an unreadable error response body', async () => {
    fetchMock.mockResolvedValueOnce({
      ...response('', 500),
      text: vi.fn(async () => Promise.reject(new Error('read failed'))),
    });

    await expect(api.get('/v1/users/123')).rejects.toThrow('HTTP 500 Internal Server Error:');
  });

  it('handles successful empty responses', async () => {
    fetchMock.mockResolvedValueOnce(response('', 204));

    await expect(api.del('/v1/messages/123')).resolves.toEqual({});
  });
});
