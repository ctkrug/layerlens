import { describe, it, expect } from 'vitest';
import { EXAMPLES, findExample } from '../src/examples';
import { analyzeSource } from '../src/core/analyze';

describe('example gallery', () => {
  it('exposes at least three examples with unique ids', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  it('every example parses into a non-empty layer stack', () => {
    for (const ex of EXAMPLES) {
      expect(analyzeSource(ex.dockerfile).layers.length).toBeGreaterThan(0);
    }
  });

  it('the node and python examples surface the copy-before-install fix', () => {
    for (const id of ['node', 'python']) {
      const ex = findExample(id)!;
      const a = analyzeSource(ex.dockerfile);
      expect(a.suggestions.some((s) => s.id === 'copy-before-install')).toBe(true);
    }
  });

  it('the go multi-stage example copies the manifest first (no install fix)', () => {
    const a = analyzeSource(findExample('go-multistage')!.dockerfile);
    expect(a.suggestions.some((s) => s.id === 'copy-before-install')).toBe(false);
    expect(a.stageCount).toBe(2);
  });
});
