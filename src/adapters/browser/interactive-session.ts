import * as path from 'node:path';
import { chromium, type Browser } from 'playwright';

export const defaultSessionPath = path.resolve(__dirname, '../session.json');
export const interactiveViewport = { width: 1440, height: 900 } as const;

export function interactiveContextInit(): { viewport: typeof interactiveViewport } {
  return { viewport: interactiveViewport };
}

export async function launchInteractiveBrowser(
  launch: () => Promise<Browser> = () => chromium.launch({ headless: false }),
): Promise<Browser> {
  return launch();
}