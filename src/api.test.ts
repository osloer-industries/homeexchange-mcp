import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
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
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    token: 'Bearer test-token',
    cookies: [
      { name: 'trusted', value: 'yes', domain: '.homeexchange.com' },
      { name: 'untrusted', value: 'no', domain: 'evilhomeexchange.com' },
    ],
    userId: '123',
  })),
}));

vi.stubGlobal('fetch', fetchMock);

describe('api client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response(JSON.stringify({ ok: true })));
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
    await api.bffPost('/v3/conversations', { message: 'hello' }, { locale: 'en' }, { 'X-Test': 'yes' });

    expect((fetchMock.mock.calls[0]?.[0] as URL).origin).toBe('https://bff.homeexchange.com');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
      headers: expect.objectContaining({ 'x-test': 'yes' }),
    });
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
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      body: undefined,
    });
  });

  it('supports API writes and deletes', async () => {
    await api.post('/v1/messages', { content: 'hello' });
    await api.del('/v1/messages/123');

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('reports an expired session without exposing the response body', async () => {
    fetchMock.mockResolvedValueOnce(response('private response', 401));

    await expect(api.get('/v1/users/123')).rejects.toThrow('Session expired');
  });

  it('limits error response details', async () => {
    fetchMock.mockResolvedValueOnce(response('x'.repeat(300), 500));

    await expect(api.get('/v1/users/123')).rejects.toThrow(`HTTP 500 Internal Server Error: ${'x'.repeat(200)}`);
  });

  it('handles successful empty responses', async () => {
    fetchMock.mockResolvedValueOnce(response('', 204));

    await expect(api.del('/v1/messages/123')).resolves.toEqual({});
  });
});
