import { describe, it, expect } from 'vitest';
import { analyzeSource } from '../src/core';
import {
  renderStack,
  renderMetrics,
  renderSuggestions,
  renderWarnings,
  stageLabel,
} from '../src/ui/render';
import { SAMPLE_DOCKERFILE } from '../src/sample';

const GO = `FROM golang:1.22 AS build\nWORKDIR /src\nCOPY . .\nRUN go build -o /bin/app ./cmd\n\nFROM alpine:3.20\nCOPY --from=build /bin/app /app\nENTRYPOINT ["/app"]\n`;

describe('renderStack', () => {
  it('renders one indexed row per layer with a cache class', () => {
    const html = renderStack(analyzeSource(SAMPLE_DOCKERFILE));
    const rows = html.match(/data-index="/g) ?? [];
    expect(rows.length).toBe(analyzeSource(SAMPLE_DOCKERFILE).layers.length);
    expect(html).toContain('rebuilds'); // the broad COPY cascade is marked
  });

  it('shows a designed empty state for no input', () => {
    expect(renderStack(analyzeSource(''))).toContain('Paste a Dockerfile');
  });

  it('groups and labels stages for a multi-stage build', () => {
    const html = renderStack(analyzeSource(GO));
    expect(html).toContain('data-stage="0"');
    expect(html).toContain('data-stage="1"');
    expect(html).toContain('build'); // the AS alias label
  });

  it('marks a COPY --from as a cross-stage edge back to its source stage', () => {
    const html = renderStack(analyzeSource(GO));
    expect(html).toContain('class="edge"');
    expect(html).toContain('↖ build'); // the edge points at the build stage
    expect(html).toMatch(/class="layer[^"]* cross"/); // the row carries the cross marker
  });

  it('renders a pathologically large stack without overflowing the stack', () => {
    const src = 'FROM alpine\n' + Array.from({ length: 150000 }, () => 'RUN echo x').join('\n');
    const html = renderStack(analyzeSource(src));
    expect(html).toContain('data-index="0"');
  });

  it('escapes instruction text to prevent HTML injection', () => {
    const html = renderStack(analyzeSource('FROM x\nRUN echo "<script>"\n'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('stageLabel', () => {
  it('prefers the AS alias, then the base image', () => {
    const a = analyzeSource(GO);
    expect(stageLabel(a, 0)).toBe('build');
    expect(stageLabel(a, 1)).toBe('alpine:3.20');
  });
});

describe('renderMetrics', () => {
  it('emits roll-ready value spans with data-value', () => {
    const html = renderMetrics(analyzeSource(SAMPLE_DOCKERFILE));
    expect(html).toContain('data-metric="wasted"');
    expect(html).toContain('data-value=');
  });
});

describe('renderSuggestions', () => {
  it('ties each annotation to its line and severity', () => {
    const html = renderSuggestions(analyzeSource(SAMPLE_DOCKERFILE));
    expect(html).toContain('data-line=');
    expect(html).toContain('suggestion high');
  });
  it('shows a designed clean state when there are no issues', () => {
    const clean = 'FROM node:20-slim\nCOPY package.json ./\nRUN npm ci\nCOPY src ./src\n';
    expect(renderSuggestions(analyzeSource(clean))).toContain('No cache or size issues');
  });
});

describe('renderWarnings', () => {
  it('is empty when the parse is clean and lists notes otherwise', () => {
    expect(renderWarnings(analyzeSource('FROM node\nRUN echo hi\n'))).toBe('');
    expect(renderWarnings(analyzeSource('RUN echo orphan\n'))).toContain('parse note');
  });
});
