// Analyzer.
//
// Given the layer model, reasons about two things Docker users care about but
// can't see: (1) the cache-invalidation cascade — for a typical source edit,
// which layers rebuild — and (2) concrete, ranked fixes that shrink the image
// or restore cache hits. All static; no build is ever run.

import type { Instruction, Layer } from './types';
import { buildLayers, totalWeight, isBroadCopy } from './layers';
import { parseDockerfile } from './parser';

export type Severity = 'high' | 'medium' | 'low';

export interface Suggestion {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  /** Line the suggestion primarily concerns. */
  readonly line: number;
  readonly detail: string;
}

export interface LayerAnalysis extends Layer {
  /**
   * True when a routine source-code edit would invalidate this layer's cache.
   * Everything at or after the first broad `COPY . .` rebuilds on every edit.
   */
  readonly rebuildsOnSourceEdit: boolean;
}

export interface Analysis {
  readonly layers: LayerAnalysis[];
  readonly totalWeight: number;
  /** Fraction (0..1) of total weight that rebuilds on a routine source edit. */
  readonly wastedCacheRatio: number;
  readonly suggestions: Suggestion[];
  readonly warnings: { line: number; message: string }[];
  readonly stageCount: number;
}

const DEP_INSTALL = /\b(npm\s+(ci|install|i)|yarn\s+install|pnpm\s+(install|i)|pip\s+install|bundle\s+install|go\s+mod\s+download|cargo\s+fetch)\b/;

/** Analyze raw Dockerfile source end to end. */
export function analyzeSource(source: string): Analysis {
  const parsed = parseDockerfile(source);
  const layers = buildLayers(parsed.instructions);
  return analyzeLayers(layers, parsed.warnings, parsed.stageCount);
}

/** Analyze a pre-built layer model (used by tests and the UI). */
export function analyzeLayers(
  layers: Layer[],
  warnings: { line: number; message: string }[],
  stageCount: number,
): Analysis {
  const firstBroadCopy = layers.findIndex(
    (l) => (l.instruction.keyword === 'COPY' || l.instruction.keyword === 'ADD') && isBroadCopy(l.instruction.args),
  );

  const annotated: LayerAnalysis[] = layers.map((l) => ({
    ...l,
    rebuildsOnSourceEdit: firstBroadCopy >= 0 && l.index >= firstBroadCopy,
  }));

  const total = totalWeight(layers);
  const wasted = annotated
    .filter((l) => l.rebuildsOnSourceEdit)
    .reduce((sum, l) => sum + l.weight, 0);

  return {
    layers: annotated,
    totalWeight: total,
    wastedCacheRatio: total > 0 ? wasted / total : 0,
    suggestions: buildSuggestions(layers),
    warnings,
    stageCount,
  };
}

/** Derive ranked suggestions from the layer stream. */
function buildSuggestions(layers: Layer[]): Suggestion[] {
  const out: Suggestion[] = [];
  const instr = layers.map((l) => l.instruction);

  out.push(...detectCopyBeforeInstall(instr));
  out.push(...detectUncleanedApt(instr));

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * The headline check: a broad `COPY . .` that precedes a dependency install
 * busts the (expensive, rarely-changing) install layer on every source edit.
 * The fix is to copy only the manifest, install, then copy the rest.
 */
function detectCopyBeforeInstall(instr: Instruction[]): Suggestion[] {
  const out: Suggestion[] = [];
  const broadCopyIdx = instr.findIndex(
    (i) => (i.keyword === 'COPY' || i.keyword === 'ADD') && isBroadCopy(i.args),
  );
  if (broadCopyIdx < 0) return out;

  for (let i = broadCopyIdx + 1; i < instr.length; i++) {
    if (instr[i].keyword === 'RUN' && DEP_INSTALL.test(instr[i].args)) {
      out.push({
        id: 'copy-before-install',
        severity: 'high',
        title: 'Dependency install runs after a broad COPY — cache is wasted',
        line: instr[broadCopyIdx].line,
        detail:
          `The \`${instr[broadCopyIdx].keyword} ${short(instr[broadCopyIdx].args)}\` on line ` +
          `${instr[broadCopyIdx].line} invalidates the install on line ${instr[i].line} whenever ` +
          `any source file changes. Copy only the dependency manifest first, run the install, ` +
          `then copy the rest — so the install layer stays cached across code edits.`,
      });
      break;
    }
  }
  return out;
}

/** Flag apt installs that never clean their package lists (image bloat). */
function detectUncleanedApt(instr: Instruction[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const i of instr) {
    if (i.keyword !== 'RUN') continue;
    if (!/\bapt(-get)?\s+install\b/.test(i.args)) continue;
    if (/rm\s+-rf?\s+\/var\/lib\/apt\/lists|--no-install-recommends.*&&.*rm|apt(-get)?\s+clean/.test(i.args)) {
      continue;
    }
    out.push({
      id: 'apt-no-clean',
      severity: 'medium',
      title: 'apt install leaves package lists behind',
      line: i.line,
      detail:
        `The install on line ${i.line} does not remove \`/var/lib/apt/lists/*\` in the same ` +
        `RUN, so those lists ship in the image. Append ` +
        `\`&& rm -rf /var/lib/apt/lists/*\` to trim the layer.`,
    });
  }
  return out;
}

function short(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
