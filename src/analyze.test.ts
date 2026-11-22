import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, createApiMap, type HarEntry } from './analyze';
import { withTempDirectory } from '../test-support/session-directory';

const entry = (
  method: string,
  url: string,
  status: number,
  headers: { name: string; value: string }[] = []
): HarEntry => ({ request: { method, url, headers }, response: { status } });

function harPaths(directory: string): { input: string; output: string } {
  return {
    input: path.join(directory, 'input.har'),
    output: path.join(directory, 'api-map.json'),
  };
}

describe('createApiMap', () => {
  it('keeps only endpoint paths and status codes', () => {
    const map = createApiMap([
      entry('GET', 'https://api.homeexchange.com/api/members?email=private@example.com', 200),
      entry('GET', 'https://api.homeexchange.com/api/members?email=private@example.com', 404),
      entry('POST', 'https://api.homeexchange.com/public/ping', 200, [
        { name: 'Authorization', value: 'Bearer secret' },
      ]),
      entry('GET', 'https://api.homeexchange.com/public/health', 200),
    ]);

    expect(map).toEqual({
      authenticatedRequestsFound: true,
      endpoints: [
        { endpoint: 'GET /api/members', statuses: ['200', '404'] },
        { endpoint: 'POST /public/ping', statuses: ['200'] },
      ],
    });
    expect(JSON.stringify(map)).not.toContain('secret');
    expect(JSON.stringify(map)).not.toContain('private@example.com');
  });

  it('reports an empty, unauthenticated capture without retaining non-API requests', () => {
    expect(createApiMap([
      entry('GET', 'https://www.homeexchange.com/profile/1', 200),
    ])).toEqual({ authenticatedRequestsFound: false, endpoints: [] });
  });
});

const ANALYZE_TEMP_PREFIX = 'homeexchange-analyze-';

describe('analyze', () => {
  it('writes a redacted endpoint map and reports its result', async () => {
    await withTempDirectory(ANALYZE_TEMP_PREFIX, (directory) => {
      const { input, output } = harPaths(directory);
      const messages: string[] = [];

      fs.writeFileSync(input, JSON.stringify({
        log: { entries: [entry('GET', 'https://api.homeexchange.com/api/exchanges', 200)] },
      }));

      const result = analyze(input, output, (message) => messages.push(message));

      expect(result.endpoints).toEqual([{ endpoint: 'GET /api/exchanges', statuses: ['200'] }]);
      expect(fs.readFileSync(output, 'utf8')).toContain('/api/exchanges');
      expect(messages).toContain('Safe API endpoint map saved to api-map.json');
    });
  });

  it('rejects a missing HAR file', async () => {
    await withTempDirectory(ANALYZE_TEMP_PREFIX, (directory) => {
      expect(() => analyze(path.join(directory, 'missing.har'))).toThrow('No HAR file found');
    });
  });

  it('reports an unauthenticated capture without disclosing its contents', async () => {
    await withTempDirectory(ANALYZE_TEMP_PREFIX, (directory) => {
      const { input, output } = harPaths(directory);
      const messages: string[] = [];

      fs.writeFileSync(input, JSON.stringify({
        log: { entries: [entry('GET', 'https://www.homeexchange.com/profile/1', 200)] },
      }));
      analyze(input, output, (message) => messages.push(message));
      expect(messages).toContain('No authenticated API requests found. Did you log in?');
      expect(fs.readFileSync(output, 'utf8')).not.toContain('/profile/1');
    });
  });
});