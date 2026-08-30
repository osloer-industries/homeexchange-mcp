import * as fs from 'fs';
import * as path from 'path';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from './security';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

interface Session {
  token: string | null;
  cookies: { name: string; value: string; domain: string }[];
  userId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value) || (value.token !== null && typeof value.token !== 'string') || (value.userId !== null && typeof value.userId !== 'string') || !Array.isArray(value.cookies)) return false;
  return value.cookies.every((cookie) => isRecord(cookie) && typeof cookie.name === 'string' && typeof cookie.value === 'string' && typeof cookie.domain === 'string');
}

function loadSession(): Session {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error('No session found. Run: npm run login');
  }
  const value: unknown = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
  if (!isSession(value)) throw new Error('Stored session has an invalid format. Run: npm run login');
  return value;
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
