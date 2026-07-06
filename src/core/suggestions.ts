// Suggestion ruleset.
//
// Each detector reads the layer model and returns zero or more concrete,
// ranked fixes. Suggestions are never vague ("consider caching"): every one
// names the offending line and states the exact change to make. Detectors are
// pure and unit-tested against fixture Dockerfiles, including a clean fixture
// that must produce nothing (no false positives).

import type { Layer } from './types';
import { isBroadCopy } from './layers';

export type Severity = 'high' | 'medium' | 'low';

export interface Suggestion {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  /** Line the suggestion primarily concerns. */
  readonly line: number;
  readonly detail: string;
  /**
   * Relative weight that would stay cached (or be trimmed) if the fix is
   * applied — computed from the size model, not a fixed string. Absent when the
   * suggestion has no size/cache payoff to quantify.
   */
  readonly estimatedSaving?: number;
}

/** Dependency-manifest installs whose fix is "copy the manifest first". */
const DEP_INSTALL =
  /\b(npm\s+(ci|install|i)|yarn\s+install|pnpm\s+(install|i)|pip\s+install|bundle\s+install|go\s+mod\s+download|cargo\s+fetch)\b/;

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Run every detector and return suggestions ranked by severity, high first. */
export function buildSuggestions(layers: Layer[]): Suggestion[] {
  const out: Suggestion[] = [
    ...detectCopyBeforeInstall(layers),
    ...detectUncleanedApt(layers),
    ...detectOrderSensitivity(layers),
  ];
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** The earliest broad COPY/ADD index within each stage, keyed by stage. */
function firstBroadCopyByStage(layers: Layer[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const l of layers) {
    const i = l.instruction;
    if ((i.keyword === 'COPY' || i.keyword === 'ADD') && isBroadCopy(i.args) && !map.has(i.stage)) {
      map.set(i.stage, l.index);
    }
  }
  return map;
}

/**
 * A rarely-changing heavy install (apt/apk/yum/…, but NOT a dependency manifest
 * install, which copy-before-install owns) placed *below* a broad COPY: it
 * rebuilds on every source edit purely because of instruction order. The fix is
 * to hoist it above the COPY.
 */
export function detectOrderSensitivity(layers: Layer[]): Suggestion[] {
  const out: Suggestion[] = [];
  const broadByStage = firstBroadCopyByStage(layers);
  for (const l of layers) {
    const i = l.instruction;
    if (i.keyword !== 'RUN' || l.weight < 6) continue; // heavy installs only
    if (DEP_INSTALL.test(i.args)) continue; // owned by copy-before-install
    const broad = broadByStage.get(i.stage);
    if (broad === undefined || l.index <= broad) continue;
    const copy = layers[broad].instruction;
    out.push({
      id: 'order-sensitivity',
      severity: 'medium',
      title: 'A rarely-changing install sits below a broad COPY',
      line: i.line,
      estimatedSaving: l.weight,
      detail:
        `The install on line ${i.line} rebuilds whenever any source file changes, because ` +
        `\`${copy.keyword} ${short(copy.args)}\` on line ${copy.line} runs first. Move this ` +
        `install above the broad COPY so it stays cached across code edits ` +
        `(relative weight ${l.weight}).`,
    });
  }
  return out;
}

/**
 * The headline check: a broad `COPY . .` that precedes a dependency install
 * busts the (expensive, rarely-changing) install layer on every source edit.
 * The fix is to copy only the manifest, install, then copy the rest.
 */
export function detectCopyBeforeInstall(layers: Layer[]): Suggestion[] {
  const out: Suggestion[] = [];
  const broadCopyIdx = layers.findIndex(
    (l) => (l.instruction.keyword === 'COPY' || l.instruction.keyword === 'ADD') && isBroadCopy(l.instruction.args),
  );
  if (broadCopyIdx < 0) return out;
  const broad = layers[broadCopyIdx].instruction;

  for (let i = broadCopyIdx + 1; i < layers.length; i++) {
    const inst = layers[i].instruction;
    if (inst.stage !== broad.stage) break; // a later stage restarts the cache lineage
    if (inst.keyword === 'RUN' && DEP_INSTALL.test(inst.args)) {
      out.push({
        id: 'copy-before-install',
        severity: 'high',
        title: 'Dependency install runs after a broad COPY — cache is wasted',
        line: broad.line,
        estimatedSaving: layers[i].weight,
        detail:
          `The \`${broad.keyword} ${short(broad.args)}\` on line ${broad.line} invalidates the ` +
          `install on line ${inst.line} whenever any source file changes. Copy only the dependency ` +
          `manifest first, run the install, then copy the rest — so the install layer (relative ` +
          `weight ${layers[i].weight}) stays cached across code edits.`,
      });
      break;
    }
  }
  return out;
}

/** Flag apt installs that never clean their package lists (image bloat). */
export function detectUncleanedApt(layers: Layer[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const l of layers) {
    const i = l.instruction;
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

export function short(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
