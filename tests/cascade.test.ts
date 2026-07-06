import { describe, it, expect } from 'vitest';
import { computeCascade, stageNames, crossStageTarget } from '../src/core/cascade';
import { buildLayers } from '../src/core/layers';
import { parseDockerfile } from '../src/core/parser';

function layersOf(src: string) {
  return buildLayers(parseDockerfile(src).instructions);
}

describe('computeCascade', () => {
  it('invalidates the seed and everything downstream in a single stage', () => {
    const layers = layersOf('FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node"]\n');
    const copyIdx = layers.findIndex((l) => l.instruction.args === '. .');
    const invalid = computeCascade(layers, [copyIdx]);
    expect(invalid.has(copyIdx)).toBe(true);
    expect(invalid.has(copyIdx + 1)).toBe(true); // RUN npm ci
    expect(invalid.has(copyIdx + 2)).toBe(true); // CMD
    expect(invalid.has(0)).toBe(false); // FROM upstream survives
    expect(invalid.has(1)).toBe(false); // WORKDIR upstream survives
  });

  it('returns an empty set for no seeds', () => {
    const layers = layersOf('FROM node:18\nCOPY . .\n');
    expect(computeCascade(layers, []).size).toBe(0);
  });

  it('does not cross into a later stage that does not depend on the seed', () => {
    const src = `FROM golang:1.22 AS build\nCOPY . .\nRUN go build -o /bin/app\n\nFROM alpine\nRUN echo hi\n`;
    const layers = layersOf(src);
    const copyIdx = layers.findIndex((l) => l.instruction.args === '. .');
    const invalid = computeCascade(layers, [copyIdx]);
    const alpineRun = layers.findIndex(
      (l) => l.instruction.keyword === 'RUN' && l.instruction.stage === 1,
    );
    expect(invalid.has(alpineRun)).toBe(false);
  });

  it('follows a COPY --from edge into the consuming stage', () => {
    const src = `FROM golang:1.22 AS build\nCOPY . .\nRUN go build -o /bin/app ./cmd\n\nFROM alpine\nCOPY --from=build /bin/app /app\nENTRYPOINT ["/app"]\n`;
    const layers = layersOf(src);
    const copyIdx = layers.findIndex((l) => l.instruction.args === '. .');
    const invalid = computeCascade(layers, [copyIdx]);
    const crossCopy = layers.findIndex((l) => /--from=build/.test(l.instruction.args));
    const entrypoint = layers.findIndex((l) => l.instruction.keyword === 'ENTRYPOINT');
    expect(invalid.has(crossCopy)).toBe(true);
    expect(invalid.has(entrypoint)).toBe(true);
  });

  it('resolves stage aliases and numeric --from targets', () => {
    const layers = layersOf('FROM golang AS build\nRUN true\n\nFROM alpine\nRUN true\n');
    const names = stageNames(layers);
    expect(names.get('build')).toBe(0);
    expect(crossStageTarget('--from=build /a /b', names)).toBe(0);
    expect(crossStageTarget('--from=0 /a /b', names)).toBe(0);
    expect(crossStageTarget('--from=nginx:latest /a /b', names)).toBeNull();
    expect(crossStageTarget('/a /b', names)).toBeNull();
  });
});
