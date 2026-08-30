import * as fs from 'fs';
import * as path from 'path';

export interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string }[];
  };
  response: { status: number };
}

export interface Har {
  log: { entries: HarEntry[] };
}

export interface ApiMap {
  endpoints: { endpoint: string; statuses: string[] }[];
  authenticatedRequestsFound: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHarEntry(value: unknown): value is HarEntry {
  if (!isRecord(value) || !isRecord(value.request) || !isRecord(value.response)) return false;
  return typeof value.request.method === 'string' && typeof value.request.url === 'string' && Array.isArray(value.request.headers) && typeof value.response.status === 'number';
}

function isHar(value: unknown): value is Har {
  return isRecord(value) && isRecord(value.log) && Array.isArray(value.log.entries) && value.log.entries.every(isHarEntry);
}

function isApiCall(entry: HarEntry): boolean {
  return entry.request.url.includes('/api/') || entry.request.headers.some(
    (header) => header.name.toLowerCase() === 'authorization'
  );
}

/**
 * Produces a safe endpoint inventory from a HAR capture. The output deliberately
 * contains no credentials, URLs with query strings, request bodies, or responses.
 */
export function createApiMap(entries: HarEntry[]): ApiMap {
  const endpoints = new Map<string, Set<string>>();
  let authenticatedRequestsFound = false;

  for (const entry of entries.filter(isApiCall)) {
    authenticatedRequestsFound ||= entry.request.headers.some(
      (header) => header.name.toLowerCase() === 'authorization'
    );
    const url = new URL(entry.request.url);
    const endpoint = `${entry.request.method} ${url.pathname}`;
    const statuses = endpoints.get(endpoint) ?? new Set<string>();
    statuses.add(entry.response.status.toString());
    endpoints.set(endpoint, statuses);
  }

  return {
    authenticatedRequestsFound,
    endpoints: [...endpoints.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([endpoint, statuses]) => ({
        endpoint,
        statuses: [...statuses].sort((left, right) => left.localeCompare(right)),
      })),
  };
}

export function analyze(
  harPath = path.resolve(__dirname, '../homeexchange.har'),
  outPath = path.resolve(__dirname, '../api-map.json'),
  log: (message: string) => void = console.log
): ApiMap {
  if (!fs.existsSync(harPath)) {
    throw new Error('No HAR file found. Run: npm run record first.');
  }

  const har: unknown = JSON.parse(fs.readFileSync(harPath, 'utf8'));
  if (!isHar(har)) throw new Error('HAR file has an invalid format.');
  const summary = createApiMap(har.log.entries);

  log(
    summary.authenticatedRequestsFound
      ? 'Authenticated API requests found. Credentials are not displayed or saved.'
      : 'No authenticated API requests found. Did you log in?'
  );
  log(`API endpoints captured (${summary.endpoints.length}):`);
  for (const { endpoint, statuses } of summary.endpoints) {
    log(`  ${endpoint}  [${statuses.join(', ')}]`);
  }

  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  log('Safe API endpoint map saved to api-map.json');
  return summary;
}

if (require.main === module) {
  try {
    analyze();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
