// Cache-cascade model.
//
// Docker builds an image by executing instructions in order; each layer's cache
// key depends on the previous layer plus the instruction. So invalidating a
// layer invalidates every later layer in the same build stage. Multi-stage
// builds are independent lineages joined by `COPY --from=<stage>`: if a stage's
// output changes, every `COPY --from` that pulls from it also busts, and the
// cascade continues into that consumer stage.
//
// `computeCascade` takes the seed layers a change touches and returns the full
// set of layer indices that would rebuild. It is pure and used both by the
// analyzer (for the "rebuilds on a source edit" metric) and by the UI hover
// sweep (the signature detail).

import type { Layer } from './types';

/** Map a stage's `AS <name>` alias (lowercased) to its 0-based stage index. */
export function stageNames(layers: Layer[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of layers) {
    if (l.instruction.keyword !== 'FROM') continue;
    const m = /\bAS\s+(\S+)/i.exec(l.instruction.args);
    if (m) map.set(m[1].toLowerCase(), l.instruction.stage);
  }
  return map;
}

/**
 * Resolve a `COPY --from=<target>` to the local build stage it depends on, or
 * null when it references an external image (e.g. `--from=nginx:latest`) or has
 * no `--from` at all — those do not participate in the local cascade.
 */
export function crossStageTarget(args: string, names: Map<string, number>): number | null {
  const m = /--from=(\S+)/.exec(args);
  if (!m) return null;
  const target = m[1].toLowerCase();
  if (names.has(target)) return names.get(target)!;
  if (/^\d+$/.test(target)) return Number(target);
  return null;
}

/**
 * Given seed layer indices whose cache is broken, return every layer index that
 * transitively rebuilds. Within a stage the cascade runs downstream from the
 * earliest broken layer; across stages it follows `COPY --from` edges.
 */
export function computeCascade(layers: Layer[], seeds: number[]): Set<number> {
  const names = stageNames(layers);
  // Earliest invalidated instruction index per stage.
  const stageFrom = new Map<number, number>();

  const seed = (idx: number): boolean => {
    if (idx < 0 || idx >= layers.length) return false;
    const stage = layers[idx].instruction.stage;
    const cur = stageFrom.get(stage);
    if (cur === undefined || idx < cur) {
      stageFrom.set(stage, idx);
      return true;
    }
    return false;
  };

  seeds.forEach(seed);

  // Propagate across `COPY --from` edges until the invalidated set stabilizes.
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of layers) {
      const from = stageFrom.get(l.instruction.stage);
      if (from === undefined || l.index < from) continue; // not (yet) invalid
      if (l.instruction.keyword !== 'COPY') continue;
      const target = crossStageTarget(l.instruction.args, names);
      if (target !== null && stageFrom.has(target) && seed(l.index)) changed = true;
    }
  }

  const invalid = new Set<number>();
  for (const l of layers) {
    const from = stageFrom.get(l.instruction.stage);
    if (from !== undefined && l.index >= from) invalid.add(l.index);
  }
  return invalid;
}
