import { describe, it, expect } from 'vitest';
import { analyzeSource } from '../src/core/analyze';
import { SAMPLE_DOCKERFILE } from '../src/sample';

describe('analyzeSource', () => {
  it('flags COPY-before-install as a high-severity suggestion', () => {
    const a = analyzeSource(SAMPLE_DOCKERFILE);
    const s = a.suggestions.find((x) => x.id === 'copy-before-install');
    expect(s).toBeDefined();
    expect(s!.severity).toBe('high');
  });

  it('flags an uncleaned apt install', () => {
    const a = analyzeSource(SAMPLE_DOCKERFILE);
    expect(a.suggestions.some((x) => x.id === 'apt-no-clean')).toBe(true);
  });

  it('does not flag COPY-before-install when the manifest is copied first', () => {
    const good = `FROM node:18\nWORKDIR /app\nCOPY package.json ./\nRUN npm ci\nCOPY . .\n`;
    const a = analyzeSource(good);
    expect(a.suggestions.some((x) => x.id === 'copy-before-install')).toBe(false);
  });

  it('marks every layer at/after the first broad COPY as rebuilding on edit', () => {
    const a = analyzeSource(SAMPLE_DOCKERFILE);
    const copy = a.layers.find((l) => l.instruction.args === '. .')!;
    const install = a.layers.find((l) => /npm ci/.test(l.instruction.args))!;
    expect(copy.rebuildsOnSourceEdit).toBe(true);
    expect(install.rebuildsOnSourceEdit).toBe(true);
    const from = a.layers.find((l) => l.instruction.keyword === 'FROM')!;
    expect(from.rebuildsOnSourceEdit).toBe(false);
  });

  it('reports a non-zero wasted-cache ratio for the sample', () => {
    const a = analyzeSource(SAMPLE_DOCKERFILE);
    expect(a.wastedCacheRatio).toBeGreaterThan(0);
    expect(a.wastedCacheRatio).toBeLessThanOrEqual(1);
  });

  it('sorts suggestions by severity, high first', () => {
    const a = analyzeSource(SAMPLE_DOCKERFILE);
    const severities = a.suggestions.map((s) => s.severity);
    const rank = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(rank[severities[i]]).toBeGreaterThanOrEqual(rank[severities[i - 1]]);
    }
  });

  it('handles an empty Dockerfile without throwing', () => {
    const a = analyzeSource('');
    expect(a.layers).toHaveLength(0);
    expect(a.wastedCacheRatio).toBe(0);
  });
});
