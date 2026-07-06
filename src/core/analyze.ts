// Analyzer.
//
// Given the layer model, reasons about two things Docker users care about but
// can't see: (1) the cache-invalidation cascade — for a typical source edit,
// which layers rebuild — and (2) concrete, ranked fixes that shrink the image
// or restore cache hits. All static; no build is ever run.

import type { Layer } from './types';
import { buildLayers, totalWeight, isBroadCopy } from './layers';
import { parseDockerfile } from './parser';
import { computeCascade } from './cascade';
import { buildSuggestions } from './suggestions';
import type { Suggestion } from './suggestions';

export type { Suggestion, Severity } from './suggestions';

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
  /**
   * Relative weight of the layers that actually ship — the final build stage
   * only. Intermediate build stages (compilers, toolchains) are discarded.
   */
  readonly imageWeight: number;
  /** Fraction (0..1) of total weight that rebuilds on a routine source edit. */
  readonly wastedCacheRatio: number;
  /** Layer indices a routine source edit invalidates (the cascade seeds' reach). */
  readonly sourceEditCascade: number[];
  readonly suggestions: Suggestion[];
  readonly warnings: { line: number; message: string }[];
  readonly stageCount: number;
}

/**
 * Seed layers a routine source edit touches: the earliest broad `COPY`/`ADD`
 * in each stage. Editing a source file busts those copies; the cascade spreads
 * from there (downstream and across `COPY --from` edges).
 */
export function sourceEditSeeds(layers: Layer[]): number[] {
  const seeds: number[] = [];
  const seen = new Set<number>();
  for (const l of layers) {
    const i = l.instruction;
    if ((i.keyword === 'COPY' || i.keyword === 'ADD') && isBroadCopy(i.args) && !seen.has(i.stage)) {
      seen.add(i.stage);
      seeds.push(l.index);
    }
  }
  return seeds;
}

/** Weight of only the final stage's layers — what the shipped image carries. */
export function finalStageWeight(layers: Layer[]): number {
  if (layers.length === 0) return 0;
  const finalStage = Math.max(...layers.map((l) => l.instruction.stage));
  return layers
    .filter((l) => l.instruction.stage === finalStage)
    .reduce((sum, l) => sum + l.weight, 0);
}

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
  const seeds = sourceEditSeeds(layers);
  const cascade = computeCascade(layers, seeds);

  const annotated: LayerAnalysis[] = layers.map((l) => ({
    ...l,
    rebuildsOnSourceEdit: cascade.has(l.index),
  }));

  const total = totalWeight(layers);
  const wasted = annotated
    .filter((l) => l.rebuildsOnSourceEdit)
    .reduce((sum, l) => sum + l.weight, 0);

  return {
    layers: annotated,
    totalWeight: total,
    imageWeight: finalStageWeight(layers),
    wastedCacheRatio: total > 0 ? wasted / total : 0,
    sourceEditCascade: [...cascade].sort((a, b) => a - b),
    suggestions: buildSuggestions(layers),
    warnings,
    stageCount,
  };
}
