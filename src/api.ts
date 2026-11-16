import * as fs from 'fs';
import * as path from 'path';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from './security';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Run: npm run login');
    this.name = 'SessionExpiredError';
  }
}

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
  const entries =
    override instanceof Headers
      ? [...override.entries()]
      : Array.isArray(override)
        ? override
        : Object.entries(override);
  return { ...base, ...(Object.fromEntries(entries) as Record<string, string>) };
}

function buildUrl(origin: string, endpoint: string, params?: Record<string, string>): URL {
  const url = new URL(`${origin}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
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
    throw new SessionExpiredError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const BFF_ORIGIN = 'https://bff.homeexchange.com';
const API_ORIGIN = 'https://api.homeexchange.com';

export const api = {
  bff<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return request<T>(buildUrl(BFF_ORIGIN, endpoint, params));
  },

  bffPost<T>(
    endpoint: string,
    body: unknown,
    params?: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<T> {
    return request<T>(buildUrl(BFF_ORIGIN, endpoint, params), {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  bffPatch<T>(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return request<T>(buildUrl(BFF_ORIGIN, endpoint, params), {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return request<T>(buildUrl(API_ORIGIN, endpoint, params));
  },

  post<T>(endpoint: string, body: unknown, params?: Record<string, string>): Promise<T> {
    return request<T>(buildUrl(API_ORIGIN, endpoint, params), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  del<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return request<T>(buildUrl(API_ORIGIN, endpoint, params), { method: 'DELETE' });
  },
};
