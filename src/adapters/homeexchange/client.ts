import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { HOMEEXCHANGE_API_ORIGINS } from '../../domain/homeexchange-origins';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from '../../security';

export interface HomeExchangeClient {
  bff(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  bffPost(
    endpoint: string,
    body: unknown,
    params?: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<unknown>;
  bffPatch(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<unknown>;
  del(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  get(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  post(endpoint: string, body: unknown, params?: Record<string, string>): Promise<unknown>;
}

const SESSION_PATH = path.resolve(__dirname, '../session.json');

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Run: npm run login');
    this.name = 'SessionExpiredError';
  }
}

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

function endpointUrl(base: string, endpoint: string, params?: Record<string, string>): URL {
  const url = new URL(`${base}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
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
    throw new SessionExpiredError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export const api: HomeExchangeClient = {
  bff(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.bff, endpoint, params));
  },

  bffPost(
    endpoint: string,
    body: unknown,
    params?: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<unknown> {
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.bff, endpoint, params), {
      method: 'POST',
      body: JSON.stringify(body),
      ...(headers ? { headers } : {}),
    });
  },

  bffPatch(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<unknown> {
    const init: RequestInit = { method: 'PATCH' };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.bff, endpoint, params), init);
  },

  get(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.api, endpoint, params));
  },

  post(endpoint: string, body: unknown, params?: Record<string, string>): Promise<unknown> {
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.api, endpoint, params), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  del(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    return request(endpointUrl(HOMEEXCHANGE_API_ORIGINS.api, endpoint, params), { method: 'DELETE' });
  },
};
