// Property-based tests. Example tests pin known cases; these assert the
// invariants that must hold for *every* input — most importantly that the
// parser and analyzer are total (never throw) on arbitrary text, and that the
// derived metrics stay within their defined ranges.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDockerfile } from '../src/core/parser';
import { buildLayers, baseImageRef } from '../src/core/layers';
import { analyzeSource } from '../src/core/analyze';
import { computeCascade } from '../src/core/cascade';

const KEYWORDS = ['FROM', 'RUN', 'COPY', 'ADD', 'ENV', 'WORKDIR', 'CMD', 'ARG', 'LABEL', 'EXPOSE'];

/** An arbitrary that leans on real Dockerfile shapes but also injects junk. */
const dockerLine = fc.oneof(
  fc.constantFrom(...KEYWORDS).chain((k) => fc.string({ maxLength: 40 }).map((a) => `${k} ${a}`)),
  fc.constantFrom('FROM node:20', 'COPY . .', 'RUN npm ci', 'FROM x AS b', 'COPY --from=b /a /b'),
  fc.string({ maxLength: 60 }), // pure junk: unknown keywords, symbols, unicode
  fc.constant(''),
  fc.constant('# a comment'),
  fc.constant('RUN echo a \\'), // dangling continuation
);

const dockerfile = fc.array(dockerLine, { maxLength: 40 }).map((ls) => ls.join('\n'));

describe('parser is total and self-consistent', () => {
  it('never throws and keeps instructions within physical bounds', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        const parsed = parseDockerfile(src);
        const physicalLines = src.split(/\r?\n/).length;
        for (const inst of parsed.instructions) {
          expect(inst.keyword).toBe(inst.keyword.toUpperCase());
          expect(inst.keyword.length).toBeGreaterThan(0);
          expect(inst.line).toBeGreaterThanOrEqual(1);
          expect(inst.line).toBeLessThanOrEqual(physicalLines);
          expect(inst.stage).toBeGreaterThanOrEqual(0);
        }
        expect(parsed.stageCount).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('never emits more instructions than there are non-empty logical lines', () => {
    fc.assert(
      fc.property(dockerfile, (src) => {
        const parsed = parseDockerfile(src);
        const candidateLines = src
          .split(/\r?\n/)
          .filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;
        expect(parsed.instructions.length).toBeLessThanOrEqual(candidateLines);
      }),
    );
  });

  it('stage index never decreases through the instruction stream', () => {
    fc.assert(
      fc.property(dockerfile, (src) => {
        const { instructions } = parseDockerfile(src);
        let last = 0;
        for (const i of instructions) {
          expect(i.stage).toBeGreaterThanOrEqual(last);
          last = i.stage;
        }
      }),
    );
  });
});

describe('analyzer stays within its defined ranges', () => {
  it('never throws and keeps ratios and weights well-formed', () => {
    fc.assert(
      fc.property(dockerfile, (src) => {
        const a = analyzeSource(src);
        expect(a.wastedCacheRatio).toBeGreaterThanOrEqual(0);
        expect(a.wastedCacheRatio).toBeLessThanOrEqual(1);
        expect(a.imageWeight).toBeGreaterThanOrEqual(0);
        expect(a.imageWeight).toBeLessThanOrEqual(a.totalWeight);
        expect(a.layers.length).toBe(parseDockerfile(src).instructions.length);
        expect(a.stageCount).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('cascade invariants', () => {
  it('seeds are always contained in the invalidated set, and indices are valid', () => {
    fc.assert(
      fc.property(dockerfile, fc.array(fc.nat(50), { maxLength: 6 }), (src, rawSeeds) => {
        const layers = buildLayers(parseDockerfile(src).instructions);
        const seeds = rawSeeds.filter((i) => i < layers.length);
        const invalid = computeCascade(layers, seeds);
        for (const s of seeds) expect(invalid.has(s)).toBe(true);
        for (const i of invalid) {
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(layers.length);
        }
      }),
    );
  });
});

describe('baseImageRef', () => {
  it('never returns a flag token', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 12 }), { maxLength: 6 }), (tokens) => {
        const ref = baseImageRef(tokens.join(' '));
        expect(ref.startsWith('--')).toBe(false);
      }),
    );
  });
});
