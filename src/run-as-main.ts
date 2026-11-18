export function runAsMain(
  entryModule: typeof module,
  run: () => Promise<void>,
  onError: (error: unknown) => void = console.error,
): void {
  if (require.main === entryModule) {
    void run().catch(onError);
  }
}