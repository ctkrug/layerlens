// Layer model.
//
// Maps each parsed instruction to a modeled image layer and estimates a
// unitless relative "weight". Real byte sizes require running the build; since
// Layerlens never does that, it infers weight from instruction semantics —
// package installs and broad COPYs dominate, metadata instructions cost ~0.
// The weights are heuristic and only meaningful *relative* to each other.

import type { Instruction, Layer, LayerKind, SizeWeight } from './types';

/** Instructions that add a filesystem layer vs. only image metadata. */
const FILESYSTEM_KEYWORDS = new Set(['RUN', 'COPY', 'ADD']);

/** Package-manager fragments that signal a heavy install layer. */
const HEAVY_INSTALL_PATTERNS: RegExp[] = [
  /\bapt(-get)?\s+install\b/,
  /\bapk\s+add\b/,
  /\byum\s+install\b/,
  /\bdnf\s+install\b/,
  /\bnpm\s+(ci|install|i)\b/,
  /\byarn\s+(install|add)\b/,
  /\bpnpm\s+(install|i|add)\b/,
  /\bpip\s+install\b/,
  /\bgem\s+install\b/,
  /\bgo\s+(build|install|mod\s+download)\b/,
  /\bcargo\s+(build|install|fetch)\b/,
  /\bmvn\b|\bgradle\b/,
];

/** COPY/ADD of a broad context (dot or wildcard) tends to be large. */
const BROAD_COPY = /(^|\s)(\.|\*|\.\/)(\s|$)/;

/**
 * Classify an instruction as a filesystem or metadata layer. In real Docker,
 * metadata instructions still create (empty) layers, but for size/cache
 * reasoning it is clearer to treat them as zero-weight metadata.
 */
export function classify(keyword: string): LayerKind {
  return FILESYSTEM_KEYWORDS.has(keyword) ? 'filesystem' : 'metadata';
}

/** Estimate a relative size weight and a note explaining it. */
export function estimateWeight(inst: Instruction): { weight: SizeWeight; note: string } {
  if (classify(inst.keyword) === 'metadata') {
    return { weight: 0, note: 'Metadata only — adds no filesystem content.' };
  }

  const args = inst.args;

  if (inst.keyword === 'RUN') {
    const heavy = HEAVY_INSTALL_PATTERNS.some((re) => re.test(args));
    if (heavy) {
      const cleaned = /rm\s+-rf?\s+\/var\/lib\/apt|--no-cache|clean\b/.test(args);
      return cleaned
        ? { weight: 6, note: 'Package install that cleans its caches — heavy but trimmed.' }
        : { weight: 9, note: 'Package install without cache cleanup — likely bloats the image.' };
    }
    return { weight: 2, note: 'Shell command — size depends on what it writes.' };
  }

  // COPY / ADD
  if (BROAD_COPY.test(args)) {
    return { weight: 7, note: 'Copies a broad context (`.`/glob) — often the largest layer.' };
  }
  if (inst.keyword === 'ADD' && /^https?:\/\//.test(args)) {
    return { weight: 4, note: 'ADD of a remote URL — size unknown until fetched.' };
  }
  return { weight: 3, note: 'Copies specific paths — moderate, bounded size.' };
}

/** Build the full layer model for a parsed instruction stream. */
export function buildLayers(instructions: Instruction[]): Layer[] {
  return instructions.map((instruction, index) => {
    const kind = classify(instruction.keyword);
    const { weight, note } = estimateWeight(instruction);
    return { index, instruction, kind, weight, sizeNote: note };
  });
}

/** Sum of all layer weights — a proxy for total relative image size. */
export function totalWeight(layers: Layer[]): number {
  return layers.reduce((sum, l) => sum + l.weight, 0);
}
