import { describe, expect, it } from 'vitest';
import { optionalNumber, optionalString, requiredString } from './args';

describe('tool argument guards', () => {
  it('returns valid values and rejects invalid input types', () => {
    expect(requiredString({ value: 'text' }, 'value')).toBe('text');
    expect(optionalString({}, 'value')).toBeUndefined();
    expect(optionalNumber({ value: 3 }, 'value')).toBe(3);
    expect(() => requiredString({}, 'value')).toThrow('value must be a string');
    expect(() => optionalString({ value: 3 }, 'value')).toThrow('value must be a string');
    expect(() => optionalNumber({ value: '3' }, 'value')).toThrow('value must be a number');
  });
});
