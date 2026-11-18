import * as fs from 'node:fs';

export function writeSessionJson(sessionPath: string, payload: unknown): void {
  fs.writeFileSync(sessionPath, JSON.stringify(payload, null, 2));
}

export async function closeBrowserWhenConnected(browser: {
  close(): Promise<void>;
  isConnected(): boolean;
}): Promise<void> {
  if (browser.isConnected()) await browser.close();
}

export function claimExclusiveSave(saving: { active: boolean }): boolean {
  if (saving.active) return false;
  saving.active = true;
  return true;
}