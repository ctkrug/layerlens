import { describe, it, expect } from 'vitest';
import { parseDockerfile } from '../src/core/parser';

describe('parseDockerfile', () => {
  it('parses a simple instruction stream', () => {
    const { instructions } = parseDockerfile('FROM node:18\nWORKDIR /app\nCMD ["node"]\n');
    expect(instructions.map((i) => i.keyword)).toEqual(['FROM', 'WORKDIR', 'CMD']);
    expect(instructions[1].args).toBe('/app');
    expect(instructions[0].line).toBe(1);
  });

  it('joins backslash line continuations into one instruction', () => {
    const src = 'FROM alpine\nRUN apk add \\\n  curl \\\n  git\n';
    const { instructions } = parseDockerfile(src);
    const run = instructions.find((i) => i.keyword === 'RUN')!;
    expect(run.args).toBe('apk add curl git');
    expect(run.line).toBe(2);
  });

  it('skips comments and blank lines, including inside a continuation', () => {
    const src = 'FROM alpine\n\n# a comment\nRUN echo a \\\n# inline comment\n  && echo b\n';
    const { instructions } = parseDockerfile(src);
    expect(instructions).toHaveLength(2);
    expect(instructions[1].args).toBe('echo a && echo b');
  });

  it('advances the stage counter on each FROM', () => {
    const src = 'FROM golang AS build\nRUN go build\nFROM alpine\nCOPY --from=build /app /app\n';
    const { instructions, stageCount } = parseDockerfile(src);
    expect(stageCount).toBe(2);
    expect(instructions.find((i) => i.keyword === 'COPY')!.stage).toBe(1);
    expect(instructions.find((i) => i.args === 'go build')!.stage).toBe(0);
  });

  it('honors the escape parser directive', () => {
    const src = '# escape=`\nFROM alpine\nRUN echo a `\n  echo b\n';
    const { instructions } = parseDockerfile(src);
    expect(instructions.find((i) => i.keyword === 'RUN')!.args).toBe('echo a echo b');
  });

  it('warns on an unknown instruction but keeps parsing', () => {
    const { instructions, warnings } = parseDockerfile('FROM alpine\nFOOBAR x\n');
    expect(instructions).toHaveLength(2);
    expect(warnings.some((w) => /unknown/.test(w.message))).toBe(true);
  });

  it('warns on a trailing continuation at end of file', () => {
    const { warnings } = parseDockerfile('FROM alpine\nRUN echo hi \\');
    expect(warnings.some((w) => /end of file/.test(w.message))).toBe(true);
  });

  it('never throws on empty input', () => {
    expect(parseDockerfile('').instructions).toHaveLength(0);
  });
});
