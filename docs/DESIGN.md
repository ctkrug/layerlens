# Layerlens — Design brief

The art direction. Decided once, here, before UI code. Every build/QA run follows this file;
change it only deliberately, in its own commit, with a reason.

## 1. Aesthetic direction

**Layerlens is a blueprint: a precise engineering schematic of a Docker build — cyan draft-lines
on deep drafting-table navy, monospace call-outs, a faint measurement grid behind everything.**

The tool statically *reasons about* a build, so it should feel like a technical drawing of one:
measured, exact, a little handsome. Not another dark-gray SaaS dashboard. The layer stack is the
draughted object at the center of the sheet; suggestions read like margin annotations from a
reviewer. Warm amber is the "warning ink" that marks problems on the print.

This direction/palette must stay distinct from recent sibling ships — blueprint-cyan-on-navy with
a grid is deliberately not the generic dark-card look.

## 2. Tokens (actual values)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0b1a2b` | drafting-table navy, page base |
| `--surface-1` | `#0f2438` | panels / cards |
| `--surface-2` | `#153048` | raised rows, inputs |
| `--ink` | `#e8f1f8` | primary text |
| `--ink-muted` | `#8fb0c7` | secondary text, labels |
| `--line` | `#2b4a66` | hairline borders, grid |
| `--accent` | `#3ad0ff` | blueprint cyan — primary lines, focus, wordmark |
| `--accent-2` | `#7cf0c8` | support mint — "cached / good" |
| `--warn` | `#ffb347` | amber warning ink — high-severity marks |
| `--danger` | `#ff6b6b` | rebuild / wasted-cache highlight |

- **Type pairing:** display + UI both technical — **`Space Grotesk`** for the wordmark and
  headings, **`IBM Plex Mono`** for Dockerfile text, layer labels, and numbers. System fallbacks:
  `ui-sans-serif` / `ui-monospace, SFMono-Regular, Menlo, monospace`.
- **Type scale:** 1.25 ratio — 12 / 13 / 15 / 19 / 24 / 30 / 38.
- **Spacing:** 8px base scale (4, 8, 12, 16, 24, 32, 48).
- **Radius:** 8px panels, 5px controls, 3px chips.
- **Depth:** layered shadow `0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px rgba(0,0,0,.35)`;
  cyan focus glow `0 0 0 2px rgba(58,208,255,.5)`.
- **Motion:** UI transitions 160ms ease-out; layer hover/highlight 120ms; the cache-cascade
  sweep 220ms ease-out. Respect `prefers-reduced-motion`.

## 3. Layout intent

Two-pane workbench under a slim title bar.

- **Desktop (1440×900):** left pane (~40%) is the **Dockerfile editor** (mono textarea with line
  numbers); right pane (~60%) is the **hero — the vertical layer stack schematic**: one bar per
  layer, width/label encoding size weight, tinted by cache state, hovering a layer highlights the
  cascade it invalidates. Suggestions dock as annotation cards beneath the stack. A top strip shows
  the two headline metrics: relative image weight and wasted-cache %.
- **Phone (390×844):** panes stack — editor first (collapsible once analyzed), then the stack
  (still the visual hero, full width), then suggestions. No horizontal scroll; the grid background
  fills to the edges.

The layer stack always owns the majority of the viewport — it is the point of the tool.

## 4. Signature detail

**The cache-cascade sweep.** Hovering (or focusing) any layer runs a 220ms cyan-to-amber sweep
*down* every layer it would invalidate, and the wasted-cache metric counts up to match — you
literally watch the cache break. Backed by a faint animated blueprint grid and corner tick-marks
that frame the sheet like a real drawing.

## 5. Juice plan

Not a game, but the analysis deserves motion:

- Layer bars **draw in** top-to-bottom on analyze (staggered 40ms, 180ms each).
- The wasted-cache % and image-weight numbers **roll** to their values (respect reduced-motion:
  snap instead).
- Hover cascade sweep (signature detail above); suggestion cards **slide+fade** in.
- Optional, off by default, WebAudio-synth "tick" on layer hover and a soft "clunk" when a
  cascade fires — mute toggle persisted in `localStorage`, AudioContext created lazily on first
  gesture, guarded for test/no-audio environments.

## Brand assets

- **Favicon:** inline SVG data-URI — three stacked cyan bars (a layer stack) on navy, one bar
  amber (the flagged layer). Monogram feel, never the default globe.
- **Wordmark:** `layer` in `--ink` + `lens` in `--accent`, Space Grotesk, tight tracking, with a
  thin cyan underline rule like a drawing's title block.

## The landing page

`site/index.html` uses this exact direction and palette — product and page are one blueprint. It
frames a static hero screenshot/inline demo of the layer stack, states the wow in one line, and
links to the app. No second brand.
