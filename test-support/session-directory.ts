import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export async function withTempDirectory<T>(
  prefix: string,
  run: (directory: string) => T | Promise<T>,
): Promise<T> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await run(directory);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

export function sessionPathIn(directory: string): string {
  return path.join(directory, 'session.json');
}