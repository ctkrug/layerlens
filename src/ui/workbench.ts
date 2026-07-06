// The interactive workbench controller.
//
// Owns the DOM: a live Dockerfile editor on the left, the layer-stack schematic
// on the right. Editing re-analyzes and re-renders synchronously (no reload).
// Hovering/focusing a layer runs the signature cache-cascade sweep. All heavy
// reasoning lives in the pure core + renderers; this file only wires events.

import { analyzeSource, computeCascade } from '../core';
import type { Analysis } from '../core';
import { EXAMPLES } from '../examples';
import { SAMPLE_DOCKERFILE } from '../sample';
import { renderMetrics, renderStack, renderSuggestions, renderWarnings } from './render';
import { rollNumber } from './counter';
import { toPercent } from './format';
import { createSfx } from './sfx';
import type { Sfx } from './sfx';

interface Refs {
  textarea: HTMLTextAreaElement;
  gutter: HTMLElement;
  metrics: HTMLElement;
  stack: HTMLElement;
  suggestions: HTMLElement;
  notice: HTMLElement;
}

/** Mount the workbench into `root`, seeded with the sample Dockerfile. */
export function mountWorkbench(root: HTMLElement): void {
  root.innerHTML = shell();
  const refs = collectRefs(root);
  const sfx = createSfx();
  wireSoundToggle(root, sfx);
  let current: Analysis = analyzeSource(SAMPLE_DOCKERFILE);
  // Previous metric values so the counters roll from the last analysis (or 0 on
  // first paint) rather than snapping — the re-rendered HTML already holds the
  // target, so we must remember where we came from.
  let prev = { weight: 0, wasted: 0, stages: 0 };

  const analyzeAndRender = (): void => {
    current = analyzeSource(refs.textarea.value);
    refs.metrics.innerHTML = renderMetrics(current);
    refs.stack.innerHTML = renderStack(current);
    refs.suggestions.innerHTML = renderSuggestions(current);
    refs.notice.innerHTML = renderWarnings(current);
    syncGutter(refs);
    rollMetrics(refs, current, prev);
    prev = { weight: current.imageWeight, wasted: toPercent(current.wastedCacheRatio), stages: current.stageCount };
    wireLayerHover(refs, () => current, sfx);
  };

  refs.textarea.value = SAMPLE_DOCKERFILE;
  refs.textarea.addEventListener('input', analyzeAndRender);
  refs.textarea.addEventListener('scroll', () => {
    refs.gutter.scrollTop = refs.textarea.scrollTop;
  });
  wireExamples(root, refs, analyzeAndRender);
  analyzeAndRender();
}

/** Roll each metric's numeric value from the previous analysis to the new one. */
function rollMetrics(refs: Refs, a: Analysis, prev: { weight: number; wasted: number; stages: number }): void {
  roll(refs.metrics, 'weight', a.imageWeight, prev.weight);
  roll(refs.metrics, 'stages', a.stageCount, prev.stages);
  const wastedNum = refs.metrics.querySelector<HTMLElement>('[data-metric="wasted"] .num');
  if (wastedNum) rollNumber(wastedNum, toPercent(a.wastedCacheRatio), String, { from: prev.wasted });
}

function roll(scope: HTMLElement, metric: string, to: number, from: number): void {
  const el = scope.querySelector<HTMLElement>(`[data-metric="${metric}"] .value`);
  if (el) rollNumber(el, to, String, { from });
}

/**
 * The signature detail: hovering or focusing a layer highlights every layer its
 * change would invalidate (via the shared cascade model) and updates the wasted
 * metric to that hovered cascade, restoring on leave.
 */
function wireLayerHover(refs: Refs, getAnalysis: () => Analysis, sfx: Sfx): void {
  const rows = [...refs.stack.querySelectorAll<HTMLElement>('.layer')];
  const wastedNum = refs.metrics.querySelector<HTMLElement>('[data-metric="wasted"] .num');
  const baseWasted = toPercent(getAnalysis().wastedCacheRatio);

  const enter = (index: number): void => {
    const a = getAnalysis();
    const hit = computeCascade(a.layers, [index]);
    let weight = 0;
    for (const r of rows) {
      const i = Number(r.dataset.index);
      r.classList.toggle('sweep', hit.has(i));
      if (hit.has(i)) weight += a.layers[i]?.weight ?? 0;
    }
    if (wastedNum) wastedNum.textContent = String(a.totalWeight > 0 ? toPercent(weight / a.totalWeight) : 0);
    sfx.tick();
    if (hit.size > 1) sfx.clunk(); // a real cascade downstream — the cache "breaks"
  };
  const leave = (): void => {
    for (const r of rows) r.classList.remove('sweep');
    if (wastedNum) wastedNum.textContent = String(baseWasted);
  };

  for (const r of rows) {
    const index = Number(r.dataset.index);
    r.addEventListener('mouseenter', () => enter(index));
    r.addEventListener('focus', () => enter(index));
    r.addEventListener('mouseleave', leave);
    r.addEventListener('blur', leave);
  }
}

/** Wire the sound on/off toggle and reflect its state in the button. */
function wireSoundToggle(root: HTMLElement, sfx: Sfx): void {
  const btn = root.querySelector<HTMLButtonElement>('.sound-toggle');
  if (!btn) return;
  const paint = (): void => {
    const on = sfx.enabled();
    btn.setAttribute('aria-pressed', String(on));
    btn.dataset.on = String(on);
    btn.textContent = on ? '♪ sound on' : '♪ sound off';
  };
  btn.addEventListener('click', () => {
    sfx.toggle();
    paint();
  });
  paint();
}

function wireExamples(root: HTMLElement, refs: Refs, rerender: () => void): void {
  for (const btn of root.querySelectorAll<HTMLElement>('[data-example]')) {
    btn.addEventListener('click', () => {
      const ex = EXAMPLES.find((e) => e.id === btn.dataset.example);
      if (!ex) return;
      refs.textarea.value = ex.dockerfile;
      rerender();
      refs.textarea.focus();
    });
  }
}

/** Keep the line-number gutter in sync with the editor's line count. */
function syncGutter(refs: Refs): void {
  const lines = refs.textarea.value.split('\n').length;
  refs.gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('');
}

function collectRefs(root: HTMLElement): Refs {
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  return {
    textarea: q<HTMLTextAreaElement>('.editor textarea'),
    gutter: q('.gutter'),
    metrics: q('.metrics'),
    stack: q('.stack'),
    suggestions: q('.suggestions'),
    notice: q('.notice-slot'),
  };
}

function shell(): string {
  const examples = EXAMPLES.map(
    (e) => `<button type="button" class="example" data-example="${e.id}">${e.label}</button>`,
  ).join('');
  return `
    <header class="topbar">
      <div class="brand">
        <div class="wordmark">layer<span class="lens">lens</span></div>
        <p class="tagline">Paste a Dockerfile — see the layer stack, the cache cascade, and where to shrink it.</p>
      </div>
      <div class="controls">
        <div class="examples" role="group" aria-label="Load an example Dockerfile">
          <span class="examples-label">try:</span>${examples}
        </div>
        <button type="button" class="sound-toggle" aria-pressed="false" aria-label="Toggle sound effects">♪ sound off</button>
      </div>
    </header>
    <main class="workbench">
      <section class="editor-pane" aria-label="Dockerfile editor">
        <div class="editor">
          <div class="gutter" aria-hidden="true"></div>
          <textarea spellcheck="false" autocapitalize="off" autocomplete="off"
            aria-label="Dockerfile source" placeholder="FROM node:20-slim&#10;WORKDIR /app&#10;COPY . .&#10;RUN npm ci"></textarea>
        </div>
        <div class="notice-slot" aria-live="polite"></div>
      </section>
      <section class="viz-pane" aria-label="Layer analysis">
        <div class="metrics"></div>
        <h2 class="pane-title">Layer stack</h2>
        <div class="stack"></div>
        <div class="annotations">
          <h2 class="pane-title">Suggestions</h2>
          <div class="suggestions"></div>
        </div>
      </section>
    </main>`;
}
