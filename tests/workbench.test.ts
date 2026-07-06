// @vitest-environment happy-dom
//
// Integration tests for the workbench controller — the interactive wow. These
// drive the real DOM: mount, edit the textarea, click an example, hover a layer
// and assert the cascade sweep. They cover the wiring the pure tests can't.

import { describe, it, expect, beforeEach } from 'vitest';
import { mountWorkbench } from '../src/ui/workbench';

function mount(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  mountWorkbench(root);
  return root;
}

function editor(root: HTMLElement): HTMLTextAreaElement {
  return root.querySelector<HTMLTextAreaElement>('.editor textarea')!;
}

function setValue(root: HTMLElement, text: string): void {
  const ta = editor(root);
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
}

describe('workbench', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts seeded with the sample and renders a non-empty stack', () => {
    const root = mount();
    expect(editor(root).value).toContain('FROM node');
    expect(root.querySelectorAll('.layer').length).toBeGreaterThan(0);
    expect(root.querySelector('.suggestion.high')).not.toBeNull();
  });

  it('re-analyzes live on input with no reload', () => {
    const root = mount();
    setValue(root, 'FROM alpine:3.20\nRUN echo hi\n');
    const rows = root.querySelectorAll('.layer');
    expect(rows.length).toBe(2);
    // A clean two-line Dockerfile has no broad COPY → nothing rebuilds on edit.
    expect(root.querySelector('.layer.rebuilds')).toBeNull();
  });

  it('shows a designed notice for garbage input rather than crashing', () => {
    const root = mount();
    setValue(root, '@@@ not a dockerfile ((( ');
    expect(root.querySelector('.notice')).not.toBeNull();
    // The page is still intact — the editor and viz panes remain mounted.
    expect(editor(root)).not.toBeNull();
    expect(root.querySelector('.stack')).not.toBeNull();
  });

  it('loads an example when its button is clicked', () => {
    const root = mount();
    const btn = root.querySelector<HTMLButtonElement>('[data-example="go-multistage"]')!;
    btn.click();
    expect(editor(root).value).toContain('AS build');
    // Multi-stage → the stack groups into two labeled stages.
    expect(root.querySelectorAll('.stage').length).toBe(2);
  });

  it('toggles the sound control and reflects state via aria-pressed', () => {
    const root = mount();
    const btn = root.querySelector<HTMLButtonElement>('.sound-toggle')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.dataset.on).toBe('true');
  });

  it('runs the cascade sweep when a layer is hovered', () => {
    const root = mount();
    setValue(root, 'FROM node:20\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node"]\n');
    const layers = [...root.querySelectorAll<HTMLElement>('.layer')];
    const copy = layers.find((l) => /COPY/.test(l.textContent ?? ''))!;
    copy.dispatchEvent(new Event('mouseenter'));
    const swept = root.querySelectorAll('.layer.sweep');
    // COPY and everything downstream (RUN, CMD) sweep; FROM/WORKDIR do not.
    expect(swept.length).toBe(3);
    copy.dispatchEvent(new Event('mouseleave'));
    expect(root.querySelectorAll('.layer.sweep').length).toBe(0);
  });
});
