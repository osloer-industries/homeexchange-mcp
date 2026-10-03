import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import {
  type Browser,
  type BrowserContext,
  type RecordingPage,
  type RecordingRequest,
  type RecordingResponse,
} from '../../application/ports/browser';
import { isHomeExchangeApiUrl } from '../../security';

const defaultSessionPath = path.resolve(__dirname, '../session.json');
const credentialHeaders = ['authorization', 'x-auth-token', 'x-access-token', 'x-api-key'];

export interface RecorderPage {
  goto(url: string): Promise<unknown>;
  onRequest(listener: (request: RecordingRequest) => void): void;
  onResponse(listener: (response: RecordingResponse) => void): void;
}

export interface RecordOptions {
  createPage?: (context: BrowserContext<RecordingPage>) => Promise<RecorderPage>;
  launchBrowser?: () => Promise<Browser<RecordingPage>>;
  log?: (message: string) => void;
  sessionPath?: string;
  waitForCompletion?: (complete: () => void) => Promise<void>;
}

export function createRecorderPage(context: BrowserContext<RecordingPage>): Promise<RecorderPage> {
  return context.newPage().then((page) => ({
    goto: (url) => page.goto(url),
    onRequest: (listener) => page.on('request', listener),
    onResponse: (listener) => page.on('response', listener),
  }));
}

export function getRequestSummary(request: RecordingRequest): string | null {
  const url = new URL(request.url());
  if (!isHomeExchangeApiUrl(url)) return null;
  return `${request.method()} ${url.pathname}`;
}

export function getResponseSummary(response: RecordingResponse): string | null {
  const url = new URL(response.request().url());
  if (!isHomeExchangeApiUrl(url)) return null;
  return `${response.status()} ${url.pathname}`;
}

export async function record({
  createPage = createRecorderPage,
  launchBrowser = () => chromium.launch({ headless: false }),
  log = console.log,
  sessionPath = defaultSessionPath,
  waitForCompletion,
}: RecordOptions = {}): Promise<void> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await createPage(context);
  const capturedHeaders: Record<string, string> = {};
  let userId: string | null = null;
  let saving = false;
  let complete: (() => void) | undefined;

  const save = async (): Promise<void> => {
    if (saving) return;
    saving = true;
    const cookies = await context.cookies();
    fs.writeFileSync(sessionPath, JSON.stringify({ cookies, headers: capturedHeaders, userId }, null, 2));
    log(`Session saved locally with ${cookies.length} cookies and ${Object.keys(capturedHeaders).length} credential headers.`);
    if (browser.isConnected()) await browser.close();
  };

  page.onRequest((request) => {
    const summary = getRequestSummary(request);
    if (!summary) return;
    const url = new URL(request.url());
    const headers = request.headers();
    for (const key of credentialHeaders) {
      const value = headers[key];
      if (value && value !== 'Bearer undefined') capturedHeaders[key] = value;
    }
    userId ??= /\/(?:users|members)\/(\d+)/.exec(url.pathname)?.[1] ?? null;
    log(`Request recorded: ${summary}`);
  });

  page.onResponse((response) => {
    const summary = getResponseSummary(response);
    if (summary) log(`Response recorded: ${summary}`);
  });
  browser.on('disconnected', () => complete?.());

  log('Browser open. Interact with HomeExchange, then close the browser or press Ctrl+C.');
  await page.goto('https://www.homeexchange.com');

  if (waitForCompletion) {
    await waitForCompletion(() => complete?.());
  } else {
    await new Promise<void>((resolve) => {
      complete = resolve;
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  }
  await save();
}
