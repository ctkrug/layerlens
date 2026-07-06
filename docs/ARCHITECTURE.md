# Layerlens — Architecture

A concise, current map of the codebase. The product is a **static, browser-only**
Dockerfile analyzer: a pure reasoning core plus a thin UI that renders it. No
server, no Docker daemon, no network — everything runs on pasted text.

## Data flow

```
raw Dockerfile text
  → parseDockerfile()      (core/parser.ts)    → ParsedDockerfile { instructions, stageCount, warnings }
  → buildLayers()          (core/layers.ts)    → Layer[]   (each instruction → a modeled layer + size weight)
  → analyzeLayers()        (core/analyze.ts)   → Analysis  (cascade, metrics, ranked suggestions)
        ├─ computeCascade() (core/cascade.ts)   — which layers rebuild on a change
        └─ buildSuggestions() (core/suggestions.ts) — the ranked fix ruleset
  → renderers              (ui/render.ts)      → HTML strings
  → mountWorkbench()       (ui/workbench.ts)   → live DOM, events, animation, sound
```

The core is pure and dependency-free; the UI is a thin renderer over it. Every
core stage is independently unit-tested.

## Core (`src/core/`) — pure, no DOM

| File | Responsibility |
|------|----------------|
| `types.ts` | Domain types: `Instruction`, `Layer`, `ParsedDockerfile`. |
| `parser.ts` | Text → `Instruction[]`. Joins line continuations, honors the `escape` directive, drops comments, tracks multi-stage `FROM` boundaries. Total (never throws; malformed input → warnings). |
| `layers.ts` | `Instruction` → `Layer` with a heuristic relative **size weight** (package installs and broad copies dominate; metadata ≈ 0). Also `isBroadCopy`, `copySources`, and `baseImageRef` (the `FROM` image, skipping `--platform`/flags). |
| `cascade.ts` | `computeCascade(layers, seeds)` — the cache-invalidation model: downstream within a stage, and across stages via `COPY --from` edges. Shared by the metric and the UI hover sweep. |
| `suggestions.ts` | The ranked fix ruleset. Each detector is pure and named-exported for testing. Rules: `copy-before-install`, `apt-no-clean`, `order-sensitivity`, `avoidable-add`, `floating-base-image`, `missing-dockerignore`. |
| `analyze.ts` | Orchestrates the pipeline into an `Analysis`: annotated layers, `imageWeight` (final stage only), `wastedCacheRatio`, the source-edit cascade, ranked suggestions. |
| `index.ts` | Public barrel — the UI and tests import from `../core`. |

## UI (`src/ui/`) — renders the core

| File | Responsibility |
|------|----------------|
| `format.ts` | DOM-free helpers: `escapeHtml`, `pluralize`, `truncate`, bar/percent scaling. |
| `render.ts` | Pure HTML-string builders: metrics, stage-grouped layer stack, suggestion annotations, empty/warning states. Unit-tested in node. |
| `counter.ts` | Rolling-number animation: pure easing + a rAF driver that snaps under reduced motion / no rAF. |
| `sfx.ts` | WebAudio-synth tick/clunk. Off by default; state persisted in `localStorage`; lazy AudioContext, fully guarded for headless envs. |
| `workbench.ts` | The controller. Owns the DOM, live re-analysis on input, example loading, the cache-cascade hover sweep, counter rolls, and the sound toggle. |

`src/main.ts` mounts the workbench into `#app`. `src/sample.ts` is the seed
Dockerfile; `src/examples.ts` is the one-click gallery (also used as fixtures).

## Run & test

```bash
npm run dev            # vite dev server
npm test               # vitest (pure core + UI renderers + happy-dom workbench integration)
npm run test:coverage  # vitest with v8 coverage over src/core + src/ui
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # tsc --noEmit && vite build  → dist/ (base-path-relative, subpath-safe)
```

Tests live in `tests/`. The workbench integration test uses a `happy-dom`
environment (`// @vitest-environment happy-dom`) to drive the real DOM; every
other test runs in plain node. `tests/property.test.ts` uses `fast-check` to
assert the totality/range invariants of the parser and analyzer across random
input. Core-logic line coverage sits at ~99%.

## Key invariants

- **Never executes Docker.** All size/cache figures are clearly *relative*
  heuristics, never claimed byte sizes (see `docs/VISION.md`).
- **The core never trusts or needs the DOM**; the UI never re-implements
  analysis — it renders `Analysis`.
- **Build output is subpath-safe** (`vite base: './'`): served from
  `apps.charliekrug.com/layerlens/`.
