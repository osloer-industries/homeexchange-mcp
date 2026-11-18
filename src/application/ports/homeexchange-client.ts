export interface HomeExchangeClient {
  bff(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  bffPost(endpoint: string, body: unknown, params?: Record<string, string>, headers?: Record<string, string>): Promise<unknown>;
  bffPatch(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<unknown>;
  del(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  get(endpoint: string, params?: Record<string, string>): Promise<unknown>;
  post(endpoint: string, body: unknown, params?: Record<string, string>): Promise<unknown>;
}
