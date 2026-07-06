import { describe, it, expect } from 'vitest';
import { buildLayers } from '../src/core/layers';
import { parseDockerfile } from '../src/core/parser';
import {
  buildSuggestions,
  detectOrderSensitivity,
  detectAvoidableAdd,
  detectFloatingBaseImage,
  detectMissingDockerignore,
  detectCopyBeforeInstall,
} from '../src/core/suggestions';

function suggest(src: string) {
  return buildSuggestions(buildLayers(parseDockerfile(src).instructions));
}
function ids(src: string) {
  return suggest(src).map((s) => s.id);
}

describe('suggestion ruleset — every suggestion is concrete', () => {
  it('each suggestion carries a stable id, severity, line, and detail', () => {
    const s = suggest('FROM node\nCOPY . .\nRUN npm ci\nADD file.txt /f\n');
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      expect(typeof x.id).toBe('string');
      expect(['high', 'medium', 'low']).toContain(x.severity);
      expect(x.line).toBeGreaterThan(0);
      expect(x.detail.length).toBeGreaterThan(20);
    }
  });
});

describe('order-sensitivity', () => {
  it('flags a heavy apt install placed below a broad COPY', () => {
    const src = `FROM debian:12\nWORKDIR /app\nCOPY . .\nRUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*\n`;
    const s = detectOrderSensitivity(buildLayers(parseDockerfile(src).instructions));
    expect(s).toHaveLength(1);
    expect(s[0].id).toBe('order-sensitivity');
    expect(s[0].estimatedSaving).toBeGreaterThan(0);
  });

  it('detects copy-before-install in the final stage even after an earlier broad COPY', () => {
    // Stage 0 has a broad COPY but no dependency install; the real
    // copy-before-install is in the final stage and must still be flagged.
    const src = `FROM node AS deps\nCOPY . .\nRUN echo hi\n\nFROM node\nCOPY . .\nRUN npm ci\n`;
    const s = detectCopyBeforeInstall(buildLayers(parseDockerfile(src).instructions));
    expect(s).toHaveLength(1);
    expect(s[0].id).toBe('copy-before-install');
    expect(s[0].line).toBe(6); // the final-stage broad COPY
  });

  it('does not double-report a dependency install (copy-before-install owns it)', () => {
    const src = `FROM node:20\nCOPY . .\nRUN npm ci\n`;
    expect(ids(src)).toContain('copy-before-install');
    expect(ids(src)).not.toContain('order-sensitivity');
  });

  it('stays silent when the install precedes the broad COPY', () => {
    const src = `FROM debian:12\nRUN apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*\nCOPY . .\n`;
    expect(detectOrderSensitivity(buildLayers(parseDockerfile(src).instructions))).toHaveLength(0);
  });
});

describe('avoidable ADD', () => {
  it('flags ADD of a plain local file', () => {
    const s = detectAvoidableAdd(buildLayers(parseDockerfile('FROM x\nADD app.jar /app.jar\n').instructions));
    expect(s.map((x) => x.id)).toEqual(['avoidable-add']);
  });

  it('leaves ADD of a URL or an archive alone', () => {
    const url = detectAvoidableAdd(buildLayers(parseDockerfile('FROM x\nADD https://ex.com/a.bin /a\n').instructions));
    const tar = detectAvoidableAdd(buildLayers(parseDockerfile('FROM x\nADD release.tar.gz /opt/\n').instructions));
    expect(url).toHaveLength(0);
    expect(tar).toHaveLength(0);
  });
});

describe('floating base image', () => {
  it('flags an untagged and an explicit :latest base', () => {
    expect(detectFloatingBaseImage(buildLayers(parseDockerfile('FROM ubuntu\n').instructions))).toHaveLength(1);
    expect(detectFloatingBaseImage(buildLayers(parseDockerfile('FROM ubuntu:latest\n').instructions))).toHaveLength(1);
  });

  it('accepts a pinned tag, a digest, scratch, and a stage reference', () => {
    const ok = `FROM node:20-slim AS build\nFROM ubuntu@sha256:abc\nFROM scratch\nFROM build\n`;
    expect(detectFloatingBaseImage(buildLayers(parseDockerfile(ok).instructions))).toHaveLength(0);
  });

  it('does not mistake a registry port for a floating tag', () => {
    const src = 'FROM registry.internal:5000/team/app:1.4\n';
    expect(detectFloatingBaseImage(buildLayers(parseDockerfile(src).instructions))).toHaveLength(0);
  });

  it('reads past a --platform flag to the real image ref', () => {
    const pinned = 'FROM --platform=$BUILDPLATFORM golang:1.21 AS build\n';
    expect(detectFloatingBaseImage(buildLayers(parseDockerfile(pinned).instructions))).toHaveLength(0);
    const floating = 'FROM --platform=linux/amd64 golang AS build\n';
    const s = detectFloatingBaseImage(buildLayers(parseDockerfile(floating).instructions));
    expect(s).toHaveLength(1);
    expect(s[0].detail).toContain('golang');
    expect(s[0].detail).not.toContain('--platform');
  });
});

describe('missing .dockerignore hint', () => {
  it('fires once when a broad COPY is present, never otherwise', () => {
    expect(detectMissingDockerignore(buildLayers(parseDockerfile('FROM x\nCOPY . .\n').instructions))).toHaveLength(1);
    expect(detectMissingDockerignore(buildLayers(parseDockerfile('FROM x\nCOPY pkg.json ./\n').instructions))).toHaveLength(0);
  });
});

describe('no false positives on a clean, well-ordered Dockerfile', () => {
  const CLEAN = `FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
`;

  it('produces zero suggestions', () => {
    expect(suggest(CLEAN)).toHaveLength(0);
  });

  it('specifically fires none of the individual rules', () => {
    const layers = buildLayers(parseDockerfile(CLEAN).instructions);
    expect(detectCopyBeforeInstall(layers)).toHaveLength(0);
    expect(detectOrderSensitivity(layers)).toHaveLength(0);
    expect(detectAvoidableAdd(layers)).toHaveLength(0);
    expect(detectFloatingBaseImage(layers)).toHaveLength(0);
    expect(detectMissingDockerignore(layers)).toHaveLength(0);
  });
});
