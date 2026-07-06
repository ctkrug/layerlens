import { describe, it, expect } from 'vitest';
import { createSfx } from '../src/ui/sfx';
import type { KeyValueStore } from '../src/ui/sfx';

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('createSfx', () => {
  it('defaults to off when nothing is stored', () => {
    expect(createSfx(fakeStore()).enabled()).toBe(false);
  });

  it('reads a persisted "on" state', () => {
    expect(createSfx(fakeStore({ 'layerlens:sound': 'on' })).enabled()).toBe(true);
  });

  it('toggles and persists the new state', () => {
    const store = fakeStore();
    const sfx = createSfx(store);
    expect(sfx.toggle()).toBe(true);
    expect(sfx.enabled()).toBe(true);
    expect(store.data['layerlens:sound']).toBe('on');
    expect(sfx.toggle()).toBe(false);
    expect(store.data['layerlens:sound']).toBe('off');
  });

  it('never throws when playing without an AudioContext (headless)', () => {
    const sfx = createSfx(fakeStore({ 'layerlens:sound': 'on' }));
    expect(() => {
      sfx.tick();
      sfx.clunk();
    }).not.toThrow();
  });

  it('works with a null store (no persistence available)', () => {
    const sfx = createSfx(null);
    expect(sfx.enabled()).toBe(false);
    expect(() => sfx.toggle()).not.toThrow();
    expect(sfx.enabled()).toBe(true);
  });
});
