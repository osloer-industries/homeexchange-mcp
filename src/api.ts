import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod/v3';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from './security';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

const sessionSchema = z.object({ token: z.string().nullable(), cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string() })), userId: z.string().nullable() });
type Session = z.infer<typeof sessionSchema>;

function loadSession(): Session {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error('No session found. Run: npm run login');
  }
  return sessionSchema.parse(JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')));
}

let cachedSession: Session | undefined;

function session(): Session {
  cachedSession ??= loadSession();
  return cachedSession;
}

function cookieHeader(): string {
  return session().cookies
    .filter((c) => {
      return isHomeExchangeHostname(c.domain);
    })
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function baseHeaders(): Record<string, string> {
  const currentSession = session();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Language': 'en',
    ...(currentSession.token ? { Authorization: currentSession.token } : {}),
    Cookie: cookieHeader(),
  };
}

function mergeHeaders(base: Record<string, string>, override?: RequestInit['headers']): Record<string, string> {
  if (!override) return base;
  const headers = new Headers(base);
  new Headers(override).forEach((value, name) => headers.set(name, value));
  return Object.fromEntries(headers.entries());
}

async function request(url: URL, init: RequestInit = {}): Promise<unknown> {
  if (!isHomeExchangeApiUrl(url)) {
    throw new Error(`Refusing request to untrusted origin: ${url.origin}`);
  }

  const res = await fetch(url, {
    ...init,
    headers: mergeHeaders(baseHeaders(), init.headers),
  });

  if (res.status === 401) {
    throw new Error('Session expired. Run: npm run login');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export const api = {
  bff(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url);
  },

  bffPost(
    endpoint: string,
    body: unknown,
    params?: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url, { method: 'POST', body: JSON.stringify(body), headers });
  },

  bffPatch(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  },

  get(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url);
  },

  post(endpoint: string, body: unknown, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url, { method: 'POST', body: JSON.stringify(body) });
  },

  del(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request(url, { method: 'DELETE' });
  },
};
