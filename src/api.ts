import * as fs from 'fs';
import * as path from 'path';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from './security';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

interface Session {
  token: string | null;
  cookies: { name: string; value: string; domain: string }[];
  userId: string | null;
}

function loadSession(): Session {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error('No session found. Run: npm run login');
  }
  return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as Session;
}

const session = loadSession();

export const userId = session.userId;

function cookieHeader(): string {
  return session.cookies
    .filter((c) => {
      return isHomeExchangeHostname(c.domain);
    })
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function baseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Language': 'en',
    ...(session.token ? { Authorization: session.token } : {}),
    Cookie: cookieHeader(),
  };
}

function mergeHeaders(base: Record<string, string>, override?: RequestInit['headers']): Record<string, string> {
  if (!override) return base;
  const entries =
    override instanceof Headers
      ? [...override.entries()]
      : Array.isArray(override)
        ? override
        : Object.entries(override);
  return { ...base, ...(Object.fromEntries(entries) as Record<string, string>) };
}

async function request<T>(url: URL, init: RequestInit = {}): Promise<T> {
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
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const api = {
  bff<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url);
  },

  bffPost<T>(endpoint: string, body: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
  },

  bffPatch<T>(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url.toString(), { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  },

  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url);
  },

  post<T>(endpoint: string, body: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
  },

  del<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url, { method: 'DELETE' });
  },
};
