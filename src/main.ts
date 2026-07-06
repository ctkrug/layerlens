// SCOPE-phase entry point: proves the core analyzer wires to the DOM by
// rendering the sample Dockerfile's analysis in the blueprint direction. The
// full interactive two-pane workbench (editable input, cache-cascade sweep,
// synth SFX) is scheduled in docs/BACKLOG.md.

import './styles.css';
import { analyzeSource } from './core';
import type { Analysis } from './core';
import { SAMPLE_DOCKERFILE } from './sample';

function renderMetric(value: string, label: string): string {
  return `<div class="metric"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

function renderLayers(a: Analysis): string {
  const max = Math.max(1, ...a.layers.map((l) => l.weight));
  return a.layers
    .map((l) => {
      const pct = Math.round((l.weight / max) * 100);
      const cls = l.rebuildsOnSourceEdit ? 'layer rebuilds' : 'layer';
      const args = l.instruction.args.length > 48 ? l.instruction.args.slice(0, 47) + '…' : l.instruction.args;
      return `<div class="${cls}" title="${escapeHtml(l.sizeNote)}">
        <span class="idx">L${l.index}</span>
        <span class="instr"><span class="keyword">${l.instruction.keyword}</span> ${escapeHtml(args)}</span>
        <span class="bar" style="width:${Math.max(pct, 6)}px"></span>
      </div>`;
    })
    .join('');
}

function renderSuggestions(a: Analysis): string {
  if (a.suggestions.length === 0) {
    return `<p class="tagline">No cache or size issues detected — this Dockerfile is tidy.</p>`;
  }
  return a.suggestions
    .map(
      (s) => `<div class="suggestion ${s.severity}">
        <span class="sev">${s.severity} · line ${s.line}</span>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.detail)}</p>
      </div>`,
    )
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function render(root: HTMLElement): void {
  const a = analyzeSource(SAMPLE_DOCKERFILE);
  const wastedPct = Math.round(a.wastedCacheRatio * 100);
  root.innerHTML = `
    <div class="wrap">
      <div class="wordmark">layer<span class="lens">lens</span></div>
      <p class="tagline">
        Paste a Dockerfile, see how it builds. Below is the analysis of a sample image —
        the interactive editor lands next.
      </p>
      <div class="metrics">
        ${renderMetric(String(a.totalWeight), 'relative image weight')}
        ${renderMetric(wastedPct + '%', 'rebuilds on a source edit')}
        ${renderMetric(String(a.stageCount), 'build stage' + (a.stageCount === 1 ? '' : 's'))}
      </div>
      <h2>Layer stack</h2>
      <div class="stack">${renderLayers(a)}</div>
      <h2>Suggestions</h2>
      <div class="suggestions">${renderSuggestions(a)}</div>
    </div>`;
}

const root = document.getElementById('app');
if (root) render(root);
