export interface SessionCookie {
  domain: string;
  name: string;
  value: string;
}

export interface LoginRequest {
  headers(): Record<string, string | undefined>;
  url(): string;
}

export interface LoginPage {
  goto(url: string): Promise<unknown>;
  on(event: 'request', listener: (request: LoginRequest) => void): void;
}

export interface RecordingRequest extends LoginRequest {
  method(): string;
}

export interface RecordingResponse {
  request(): { url(): string };
  status(): number;
}

export interface RecordingPage {
  goto(url: string): Promise<unknown>;
  on(event: 'request', listener: (request: RecordingRequest) => void): void;
  on(event: 'response', listener: (response: RecordingResponse) => void): void;
}

export interface BrowserContext<Page, Cookie = unknown> {
  cookies(): Promise<Cookie[]>;
  newPage(): Promise<Page>;
}

export interface Browser<Page, Cookie = unknown> {
  close(): Promise<void>;
  isConnected(): boolean;
  newContext(options: { viewport: { height: number; width: number } }): Promise<BrowserContext<Page, Cookie>>;
  on(event: 'disconnected', listener: () => void): void;
}
