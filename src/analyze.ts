import * as fs from 'node:fs';
import * as path from 'node:path';

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string }[];
    postData?: { text?: string };
  };
  response: {
    status: number;
    headers: { name: string; value: string }[];
    content: { text?: string; mimeType: string };
  };
}

interface Har {
  log: { entries: HarEntry[] };
}

export function extractToken(entries: HarEntry[]): string | null {
  for (const entry of entries) {
    const auth = entry.request.headers.find(
      (h) => h.name.toLowerCase() === 'authorization'
    );
    if (auth) return auth.value;
  }
  return null;
}

export function compareEndpointKeys(
  left: [string, Set<string>],
  right: [string, Set<string>]
): number {
  return left[0].localeCompare(right[0]);
}

function analyze() {
  const harPath = path.resolve(__dirname, '../homeexchange.har');

  if (!fs.existsSync(harPath)) {
    console.error('No HAR file found. Run: npm run record first.');
    process.exit(1);
  }

  const har: Har = JSON.parse(fs.readFileSync(harPath, 'utf8')) as Har;
  const entries = har.log.entries;

  // Filter to API calls only
  const apiCalls = entries.filter((e) =>
    e.request.url.includes('/api/') ||
    e.request.headers.some(
      (h) => h.name.toLowerCase() === 'authorization'
    )
  );

  // Extract auth token
  const token = extractToken(apiCalls);
  if (token) {
    console.log('\n🔑 Auth token found:');
    console.log(`   ${token.slice(0, 60)}...`);
  } else {
    console.log('\n⚠️  No auth token found - did you log in?');
  }

  // Group endpoints
  const endpoints = new Map<string, Set<string>>();
  for (const entry of apiCalls) {
    const url = new URL(entry.request.url);
    const key = `${entry.request.method} ${url.pathname}`;
    if (!endpoints.has(key)) endpoints.set(key, new Set());
    endpoints.get(key)!.add(entry.response.status.toString());
  }

  console.log(`\n📡 API endpoints captured (${endpoints.size}):\n`);
  for (const [endpoint, statuses] of [...endpoints.entries()].sort(compareEndpointKeys)) {
    console.log(`   ${endpoint}  [${[...statuses].join(', ')}]`);
  }

  // Save summary
  const summary = {
    token,
    endpoints: [...endpoints.entries()].map(([endpoint, statuses]) => ({
      endpoint,
      statuses: [...statuses],
    })),
    rawApiCalls: apiCalls.map((e) => ({
      method: e.request.method,
      url: e.request.url,
      status: e.response.status,
      requestBody: e.request.postData?.text ?? null,
      responseBody: e.response.content.text ?? null,
    })),
  };

  const outPath = path.resolve(__dirname, '../api-map.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Full API map saved to api-map.json`);
}

if (process.argv[1] === __filename) {
  analyze();
}
