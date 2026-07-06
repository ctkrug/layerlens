import { describe, it, expect } from 'vitest';
import { parseDockerfile } from '../src/core/parser';
import { buildLayers, classify, totalWeight } from '../src/core/layers';

describe('layer model', () => {
  it('classifies filesystem vs metadata instructions', () => {
    expect(classify('RUN')).toBe('filesystem');
    expect(classify('COPY')).toBe('filesystem');
    expect(classify('ADD')).toBe('filesystem');
    expect(classify('ENV')).toBe('metadata');
    expect(classify('CMD')).toBe('metadata');
  });

  it('gives metadata layers zero weight', () => {
    const { instructions } = parseDockerfile('FROM alpine\nENV A=1\nEXPOSE 80\n');
    const layers = buildLayers(instructions);
    expect(layers.every((l) => (l.kind === 'metadata' ? l.weight === 0 : true))).toBe(true);
  });

  it('weighs an uncleaned package install heavier than a cleaned one', () => {
    const dirty = buildLayers(parseDockerfile('FROM x\nRUN apt-get install -y curl\n').instructions);
    const clean = buildLayers(
      parseDockerfile('FROM x\nRUN apt-get install -y curl && rm -rf /var/lib/apt/lists/*\n').instructions,
    );
    const dirtyRun = dirty.find((l) => l.instruction.keyword === 'RUN')!;
    const cleanRun = clean.find((l) => l.instruction.keyword === 'RUN')!;
    expect(dirtyRun.weight).toBeGreaterThan(cleanRun.weight);
  });

  it('weighs a broad COPY heavier than a specific one', () => {
    const layers = buildLayers(parseDockerfile('FROM x\nCOPY package.json .\nCOPY . .\n').instructions);
    const specific = layers.find((l) => l.instruction.args === 'package.json .')!;
    const broad = layers.find((l) => l.instruction.args === '. .')!;
    expect(broad.weight).toBeGreaterThan(specific.weight);
  });

  it('totalWeight sums layer weights', () => {
    const layers = buildLayers(parseDockerfile('FROM x\nCOPY . .\nRUN npm ci\n').instructions);
    expect(totalWeight(layers)).toBe(layers.reduce((s, l) => s + l.weight, 0));
  });
});
