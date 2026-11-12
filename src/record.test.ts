import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAndExit, type RecordState } from './record';

const writeFileSync = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  writeFileSync,
}));

describe('saveAndExit', () => {
  beforeEach(() => {
    writeFileSync.mockReset();
  });

  it('awaits browser shutdown before exiting', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as typeof process.exit);
    const close = vi.fn(async () => undefined);
    const cookies = vi.fn(async () => [{ name: 'sid', value: '1', domain: '.homeexchange.com' }]);

    const state: RecordState = {
      browser: { close } as unknown as RecordState['browser'],
      ctx: { cookies } as unknown as RecordState['ctx'],
      userId: '42',
      capturedHeaders: { authorization: 'Bearer test' },
      sessionPath: '/tmp/session.json',
    };

    await expect(saveAndExit(state)).rejects.toThrow('exit:0');
    expect(close).toHaveBeenCalledOnce();
    expect(cookies).toHaveBeenCalledOnce();
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/session.json',
      JSON.stringify(
        {
          cookies: [{ name: 'sid', value: '1', domain: '.homeexchange.com' }],
          headers: { authorization: 'Bearer test' },
          userId: '42',
        },
        null,
        2
      )
    );

    exit.mockRestore();
  });
});
