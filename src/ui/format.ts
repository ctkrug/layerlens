// Small pure formatting helpers shared by the renderers. Kept DOM-free so they
// are unit-testable in a plain node environment.

/** Escape the five characters that are unsafe in HTML text/attribute context. */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** `pluralize(1, 'stage')` -> "stage"; `pluralize(2, 'stage')` -> "stages". */
export function pluralize(n: number, singular: string, plural = singular + 's'): string {
  return n === 1 ? singular : plural;
}

/** Truncate to `max` characters with an ellipsis, for tight layout labels. */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Percent (0..1 -> 0..100) rounded to a whole number. */
export function toPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

/**
 * Bar length as a percentage of the heaviest layer, floored so even a
 * zero-weight metadata layer shows a sliver (it still exists in the stack).
 */
export function barPercent(weight: number, max: number, floor = 4): number {
  if (max <= 0) return floor;
  return Math.max(floor, Math.round((weight / max) * 100));
}
