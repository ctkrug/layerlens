import { describe, it, expect } from 'vitest';
import { parseDockerfile } from '../src/core/parser';
import { buildLayers, classify, totalWeight, isBroadCopy, copySources } from '../src/core/layers';

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

  it('treats `.`, `./`, and glob sources as a broad copy', () => {
    expect(isBroadCopy('. .')).toBe(true);
    expect(isBroadCopy('./ /app')).toBe(true);
    expect(isBroadCopy('*.json ./')).toBe(true); // a glob source is broad
    expect(isBroadCopy('src/**/*.ts /app/')).toBe(true);
  });

  it('does not treat specific sources or a `.` destination as broad', () => {
    expect(isBroadCopy('package.json .')).toBe(false); // dest `.` is not a source
    expect(isBroadCopy('src ./src')).toBe(false);
    expect(isBroadCopy('--from=build /app/dist /usr/share/nginx/html')).toBe(false);
  });

  it('copySources drops flags and the destination', () => {
    expect(copySources('--from=build /a /b /dest')).toEqual(['/a', '/b']);
    expect(copySources('only-one')).toEqual(['only-one']); // no dest to drop
    expect(copySources('')).toEqual([]);
  });

  it('weighs a heredoc-bodied install as a heavy layer', () => {
    const src = 'FROM debian:12\nRUN <<EOT\napt-get update\napt-get install -y curl\nEOT\n';
    const run = buildLayers(parseDockerfile(src).instructions).find((l) => l.instruction.keyword === 'RUN')!;
    expect(run.weight).toBeGreaterThanOrEqual(6); // the install in the body is detected
  });

  it('totalWeight sums layer weights', () => {
    const layers = buildLayers(parseDockerfile('FROM x\nCOPY . .\nRUN npm ci\n').instructions);
    expect(totalWeight(layers)).toBe(layers.reduce((s, l) => s + l.weight, 0));
  });
});
