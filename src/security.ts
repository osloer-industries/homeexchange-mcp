const API_HOSTNAMES = new Set([
  'api.homeexchange.com',
  'bff.homeexchange.com',
]);

export function isHomeExchangeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\./, '');
  return normalized === 'homeexchange.com' || normalized.endsWith('.homeexchange.com');
}

export function isHomeExchangeApiUrl(url: URL): boolean {
  return url.protocol === 'https:' && API_HOSTNAMES.has(url.hostname.toLowerCase());
}

const USER_OR_MEMBER_PATH = /\/(?:users|members)\/(\d+)/;

export function userIdFromPathname(pathname: string): string | null {
  return USER_OR_MEMBER_PATH.exec(pathname)?.[1] ?? null;
}
