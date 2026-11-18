import {
  type Browser,
  type BrowserContext,
  type RecordingPage,
  type RecordingRequest,
  type RecordingResponse,
} from '../../application/ports/browser';
import { isHomeExchangeApiUrl } from '../../security';
import { getUserId } from './login';
import { defaultSessionPath, interactiveContextInit, launchInteractiveBrowser } from './interactive-session';
import { claimExclusiveSave, closeBrowserWhenConnected, writeSessionJson } from './session-json';
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
  launchBrowser = launchInteractiveBrowser,
  log = console.log,
  sessionPath = defaultSessionPath,
  waitForCompletion,
}: RecordOptions = {}): Promise<void> {
  const browser = await launchBrowser();
  const context = await browser.newContext(interactiveContextInit());
  const page = await createPage(context);
  const capturedHeaders: Record<string, string> = {};
  let userId: string | null = null;
  const saving = { active: false };
  let complete: (() => void) | undefined;

  const save = async (): Promise<void> => {
    if (!claimExclusiveSave(saving)) return;
    const cookies = await context.cookies();
    writeSessionJson(sessionPath, { cookies, headers: capturedHeaders, userId });
    log(`Session saved locally with ${cookies.length} cookies and ${Object.keys(capturedHeaders).length} credential headers.`);
    await closeBrowserWhenConnected(browser);
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
    userId ??= getUserId(url);
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
