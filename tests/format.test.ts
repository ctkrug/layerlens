import { describe, it, expect } from 'vitest';
import { escapeHtml, pluralize, truncate, toPercent, barPercent } from '../src/ui/format';

describe('escapeHtml', () => {
  it('escapes all five unsafe characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
  it('leaves safe text untouched', () => {
    expect(escapeHtml('RUN npm ci')).toBe('RUN npm ci');
  });
});

describe('pluralize', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'stage')).toBe('stage');
    expect(pluralize(0, 'stage')).toBe('stages');
    expect(pluralize(2, 'stage')).toBe('stages');
  });
  it('accepts an irregular plural', () => {
    expect(pluralize(3, 'index', 'indices')).toBe('indices');
  });
});

describe('truncate', () => {
  it('shortens with an ellipsis past the limit', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });
  it('leaves short strings intact', () => {
    expect(truncate('abc', 4)).toBe('abc');
  });
});

describe('toPercent / barPercent', () => {
  it('rounds a ratio to a whole percent', () => {
    expect(toPercent(0.333)).toBe(33);
    expect(toPercent(1)).toBe(100);
  });
  it('scales a bar and floors tiny weights to a visible sliver', () => {
    expect(barPercent(9, 9)).toBe(100);
    expect(barPercent(0, 9)).toBe(4);
    expect(barPercent(5, 0)).toBe(4); // guards divide-by-zero
  });
});
