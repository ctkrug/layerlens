// Synthesized sound effects — a subtle "tick" on layer hover and a soft "clunk"
// when a cache cascade fires. Everything is generated with WebAudio oscillators
// (no audio files). Sound is OFF by default (see docs/DESIGN.md); the toggle
// state persists in localStorage.
//
// The AudioContext is created lazily on the first sound after enabling (browser
// autoplay policy) and every path is guarded so tests and audio-less
// environments never throw.

const STORAGE_KEY = 'layerlens:sound';

/** Minimal storage shape so tests can inject a fake without a real localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Sfx {
  /** Whether sound is currently enabled. */
  enabled(): boolean;
  /** Flip enabled state, persist it, and return the new value. */
  toggle(): boolean;
  tick(): void;
  clunk(): void;
}

type AudioCtor = typeof AudioContext;

function resolveAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Build the sound controller. `store` defaults to localStorage when present.
 * Enabled state is read once from storage; default (no stored value) is off.
 */
export function createSfx(store: KeyValueStore | null = defaultStore()): Sfx {
  let on = store?.getItem(STORAGE_KEY) === 'on';
  const AudioCtor = resolveAudioCtor();
  let ctx: AudioContext | null = null;
  let lastTick = 0;

  const context = (): AudioContext | null => {
    if (!AudioCtor) return null;
    if (!ctx) {
      try {
        ctx = new AudioCtor();
      } catch {
        return null;
      }
    }
    return ctx;
  };

  /** A single short enveloped tone. Silent when disabled or audio is missing. */
  const blip = (freq: number, durMs: number, type: OscillatorType, gain: number): void => {
    if (!on) return;
    const ac = context();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
      osc.connect(amp).connect(ac.destination);
      osc.start(now);
      osc.stop(now + durMs / 1000 + 0.02);
    } catch {
      /* audio unavailable — stay silent */
    }
  };

  return {
    enabled: () => on,
    toggle: () => {
      on = !on;
      store?.setItem(STORAGE_KEY, on ? 'on' : 'off');
      return on;
    },
    tick: () => {
      // Rate-throttle so sweeping the mouse across the stack doesn't machine-gun.
      const t = now();
      if (t - lastTick < 45) return;
      lastTick = t;
      blip(880, 40, 'triangle', 0.05);
    },
    clunk: () => blip(150, 130, 'sawtooth', 0.08),
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
