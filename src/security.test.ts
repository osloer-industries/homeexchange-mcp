import { describe, expect, it } from 'vitest';
import { isHomeExchangeApiUrl, isHomeExchangeHostname } from './security';

describe('isHomeExchangeHostname', () => {
  it.each([
    'homeexchange.com',
    'www.homeexchange.com',
    '.api.homeexchange.com',
    'BFF.HOMEEXCHANGE.COM',
  ])('accepts trusted hostname %s', (hostname) => {
    expect(isHomeExchangeHostname(hostname)).toBe(true);
  });

  it.each([
    'evilhomeexchange.com',
    'homeexchange.com.example.org',
    'example.org',
  ])('rejects untrusted hostname %s', (hostname) => {
    expect(isHomeExchangeHostname(hostname)).toBe(false);
  });
});

describe('isHomeExchangeApiUrl', () => {
  it.each([
    'https://api.homeexchange.com/v1/users/1',
    'https://bff.homeexchange.com/v3/conversations/me',
  ])('accepts trusted API URL %s', (value) => {
    expect(isHomeExchangeApiUrl(new URL(value))).toBe(true);
  });

  it.each([
    'http://api.homeexchange.com/v1/users/1',
    'https://homeexchange.com/api',
    'https://api.homeexchange.com.example.org/v1/users/1',
  ])('rejects untrusted API URL %s', (value) => {
    expect(isHomeExchangeApiUrl(new URL(value))).toBe(false);
  });
});
