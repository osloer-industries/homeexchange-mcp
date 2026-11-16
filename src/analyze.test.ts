import { describe, expect, it } from 'vitest';
import { compareEndpointKeys, extractToken } from './analyze';

describe('extractToken', () => {
  it('reads the first authorization header', () => {
    const token = extractToken([
      {
        request: {
          method: 'GET',
          url: 'https://api.homeexchange.com/v1/users/1',
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: 'Authorization', value: 'Bearer abc' },
          ],
        },
        response: { status: 200, headers: [], content: { mimeType: 'application/json' } },
      },
    ]);

    expect(token).toBe('Bearer abc');
  });

  it('returns null when no authorization header exists', () => {
    expect(
      extractToken([
        {
          request: {
            method: 'GET',
            url: 'https://api.homeexchange.com/v1/users/1',
            headers: [{ name: 'Accept', value: 'application/json' }],
          },
          response: { status: 200, headers: [], content: { mimeType: 'application/json' } },
        },
      ])
    ).toBeNull();
  });
});

describe('compareEndpointKeys', () => {
  it('orders endpoints lexicographically by method and path', () => {
    const sorted = [
      ['POST /v1/messages', new Set(['200'])],
      ['GET /v1/users', new Set(['200'])],
      ['GET /v2/favorites', new Set(['200'])],
    ] as [string, Set<string>][];

    sorted.sort(compareEndpointKeys);

    expect(sorted.map(([endpoint]) => endpoint)).toEqual([
      'GET /v1/users',
      'GET /v2/favorites',
      'POST /v1/messages',
    ]);
  });
});
