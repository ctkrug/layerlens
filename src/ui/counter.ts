// Rolling number counters for the headline metrics. The easing math is pure and
// tested; the DOM driver is a thin wrapper that respects prefers-reduced-motion
// (snapping straight to the target) and guards against a missing rAF (tests).

/** Ease-out cubic: fast start, gentle settle. t in [0,1]. */
export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

/** Interpolate from -> to at eased progress p, rounded to a whole number. */
export function rollValue(from: number, to: number, p: number): number {
  return Math.round(from + (to - from) * easeOutCubic(p));
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Animate `el`'s text from its current numeric value to `to` over `durationMs`,
 * formatting each frame with `format`. Snaps immediately under reduced motion or
 * when requestAnimationFrame is unavailable. Returns a cancel function.
 */
export function rollNumber(
  el: HTMLElement,
  to: number,
  format: (n: number) => string,
  durationMs = 600,
): () => void {
  const from = parseInt(el.dataset.value ?? '0', 10) || 0;
  el.dataset.value = String(to);

  if (from === to || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    el.textContent = format(to);
    return () => {};
  }

  let raf = 0;
  let start = -1;
  const step = (ts: number): void => {
    if (start < 0) start = ts;
    const p = (ts - start) / durationMs;
    el.textContent = format(rollValue(from, to, p));
    if (p < 1) raf = requestAnimationFrame(step);
    else el.textContent = format(to);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
