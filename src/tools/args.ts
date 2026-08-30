export type Args = Record<string, unknown>;

export function requiredString(args: Args, name: string): string {
  const value = args[name];
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

export function optionalString(args: Args, name: string): string | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

export function optionalNumber(args: Args, name: string): number | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'number') throw new Error(`${name} must be a number`);
  return value;
}
