import { describe, it, expect } from 'vitest';
import { easeOutCubic, rollValue } from '../src/ui/counter';

describe('easeOutCubic', () => {
  it('pins the endpoints and clamps out-of-range input', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
  it('eases out — more than half progress by the midpoint', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('rollValue', () => {
  it('returns the exact endpoints', () => {
    expect(rollValue(0, 42, 0)).toBe(0);
    expect(rollValue(0, 42, 1)).toBe(42);
  });
  it('counts monotonically toward the target', () => {
    const a = rollValue(0, 100, 0.25);
    const b = rollValue(0, 100, 0.75);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThanOrEqual(100);
  });
  it('rolls downward too', () => {
    expect(rollValue(100, 0, 1)).toBe(0);
    expect(rollValue(100, 0, 0.5)).toBeLessThan(100);
  });
});
