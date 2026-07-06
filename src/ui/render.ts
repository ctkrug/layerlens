// Pure HTML renderers for the workbench panes.
//
// Each function takes the Analysis (or a slice of it) and returns an HTML
// string. They never touch the DOM, so they unit-test in node and keep the
// controller (workbench.ts) thin: it just swaps innerHTML and wires events.

import type { Analysis, LayerAnalysis } from '../core';
import { stageNames, crossStageTarget } from '../core';
import { escapeHtml, truncate, toPercent, pluralize, barPercent } from './format';

/** Human label for a build stage: its `AS` alias, base image, or ordinal. */
export function stageLabel(a: Analysis, stage: number): string {
  const from = a.layers.find((l) => l.instruction.keyword === 'FROM' && l.instruction.stage === stage);
  if (!from) return `stage ${stage}`;
  const args = from.instruction.args;
  const alias = /\bAS\s+(\S+)/i.exec(args);
  if (alias) return alias[1];
  const image = args.split(/\s+/)[0] ?? '';
  return image || `stage ${stage}`;
}

/** The two headline metrics plus a stage count, with roll-ready value spans. */
export function renderMetrics(a: Analysis): string {
  const wasted = toPercent(a.wastedCacheRatio);
  return `
    <div class="metric" data-metric="weight">
      <div class="value" data-value="${a.imageWeight}">${a.imageWeight}</div>
      <div class="label">relative image weight</div>
    </div>
    <div class="metric ${wasted >= 50 ? 'hot' : ''}" data-metric="wasted">
      <div class="value" data-value="${wasted}"><span class="num">${wasted}</span><span class="unit">%</span></div>
      <div class="label">rebuilds on a source edit</div>
    </div>
    <div class="metric" data-metric="stages">
      <div class="value" data-value="${a.stageCount}">${a.stageCount}</div>
      <div class="label">build ${pluralize(a.stageCount, 'stage')}</div>
    </div>`;
}

/** One layer row. `data-index` links it to the cascade model for the hover sweep. */
function renderLayer(l: LayerAnalysis, maxWeight: number, fromLabel: string | null): string {
  const pct = barPercent(l.weight, maxWeight);
  const cache = l.rebuildsOnSourceEdit ? 'rebuilds' : l.kind === 'metadata' ? 'metadata' : 'cached';
  const chip =
    cache === 'rebuilds' ? 'rebuilds on edit' : cache === 'metadata' ? 'metadata' : 'stays cached';
  // A COPY --from renders a visible cross-stage edge badge back to its source.
  const edge = fromLabel
    ? `<span class="edge" title="pulls from stage ${escapeHtml(fromLabel)}">↖ ${escapeHtml(fromLabel)}</span>`
    : '';
  return `<button type="button" class="layer ${cache}${fromLabel ? ' cross' : ''}" data-index="${l.index}"
      aria-label="Layer ${l.index}: ${escapeHtml(l.instruction.keyword)}${fromLabel ? ` from stage ${escapeHtml(fromLabel)}` : ''} — ${escapeHtml(chip)}. ${escapeHtml(l.sizeNote)}">
      <span class="idx">L${l.index}</span>
      <span class="instr"><span class="keyword">${escapeHtml(l.instruction.keyword)}</span> ${escapeHtml(truncate(l.instruction.args, 52))}${edge}</span>
      <span class="track"><span class="bar" style="width:${pct}%"></span></span>
      <span class="chip">${chip}</span>
    </button>`;
}

/** Resolve a COPY --from layer to its source-stage label, or null. */
function crossStageLabel(a: Analysis, l: LayerAnalysis, names: Map<string, number>): string | null {
  if (l.instruction.keyword !== 'COPY') return null;
  const target = crossStageTarget(l.instruction.args, names);
  return target === null ? null : stageLabel(a, target);
}

/** The layer stack, grouped and labeled by build stage. */
export function renderStack(a: Analysis): string {
  if (a.layers.length === 0) return renderEmptyStack();
  const maxWeight = Math.max(1, ...a.layers.map((l) => l.weight));
  const names = stageNames(a.layers);
  const stages = [...new Set(a.layers.map((l) => l.instruction.stage))].sort((x, y) => x - y);

  return stages
    .map((stage) => {
      const rows = a.layers.filter((l) => l.instruction.stage === stage);
      const multi = stages.length > 1;
      const header = multi
        ? `<div class="stage-head"><span class="stage-tag">stage ${stage}</span><span class="stage-name">${escapeHtml(stageLabel(a, stage))}</span></div>`
        : '';
      return `<section class="stage" data-stage="${stage}">${header}
        ${rows.map((l) => renderLayer(l, maxWeight, crossStageLabel(a, l, names))).join('')}
      </section>`;
    })
    .join('');
}

/** Designed empty state for when there is nothing to analyze yet. */
export function renderEmptyStack(): string {
  return `<div class="empty">
      <div class="empty-mark" aria-hidden="true">▤▤▤</div>
      <p>Paste a Dockerfile on the left to see its layer stack.</p>
    </div>`;
}

/** Suggestion annotations, rendered as margin notes tied to their line. */
export function renderSuggestions(a: Analysis): string {
  if (a.suggestions.length === 0) {
    return `<div class="suggestion empty-note">
        <span class="sev ok">clean</span>
        <h3>No cache or size issues found</h3>
        <p>This Dockerfile is well ordered — dependencies install before the broad copy,
        and nothing obvious bloats the image.</p>
      </div>`;
  }
  return a.suggestions
    .map(
      (s) => `<div class="suggestion ${s.severity}" data-line="${s.line}">
        <span class="sev">${s.severity} · line ${s.line}</span>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.detail)}</p>
      </div>`,
    )
    .join('');
}

/** Non-fatal parse warnings shown as a subtle inline notice (never a crash). */
export function renderWarnings(a: Analysis): string {
  if (a.warnings.length === 0) return '';
  const items = a.warnings
    .map((w) => `<li>line ${w.line}: ${escapeHtml(w.message)}</li>`)
    .join('');
  return `<div class="notice" role="status">
      <strong>${a.warnings.length} parse ${pluralize(a.warnings.length, 'note')}</strong>
      <ul>${items}</ul>
    </div>`;
}
