# Layerlens

**▶ Live demo: [apps.charliekrug.com/layerlens](https://apps.charliekrug.com/layerlens/)**

[![CI](https://github.com/ctkrug/layerlens/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/layerlens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

See which Docker layers rebuild on a code change, and why.

Layerlens is a static Dockerfile analyzer that runs entirely in your browser. Paste a
Dockerfile and it reads the build the way the Docker daemon does, one instruction and one
layer at a time, then shows you a visual layer stack, marks which layers rebuild on a routine
source edit, and names the exact reorder that keeps them cached. No daemon, no `docker build`,
no uploading your source anywhere.

It is for backend and platform engineers who hand-write Dockerfiles and keep waiting on rebuilds
that should have been cache hits.

## What you see

Paste the Dockerfile below and Layerlens reports a relative image weight of **25**, that **64%**
of it rebuilds on a one-character source edit, and three ranked fixes:

```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y curl git
WORKDIR /app
COPY . .
RUN npm ci --production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

```
relative image weight  25      rebuilds on a source edit  64%      build stages  1

[high]   line 4  Dependency install runs after a broad COPY, so cache is wasted
[medium] line 2  apt install leaves package lists behind
[low]    line 4  Broad COPY, so make sure a .dockerignore exists
```

The high-severity note is the one that matters: `COPY . .` on line 4 sits above `RUN npm ci`,
so every source edit re-runs the install. Copy the manifest first, install, then copy the rest,
and that layer stays cached across code changes.

## Why it helps

- **Find the cache-busting line in seconds.** Hover any layer and Layerlens sweeps down every
  layer that layer's change would invalidate, and the "rebuilds on a source edit" number updates
  to match. You watch the cache break instead of guessing.
- **Get the fix, not a lecture.** Every suggestion names the offending line and the exact change:
  "move the `COPY` on line 4 below `RUN npm ci`," ranked by severity, with the relative weight the
  fix keeps cached.
- **Read multi-stage builds correctly.** Layerlens tracks `FROM ... AS` boundaries and
  `COPY --from=` edges, so it knows a change in a build stage cascades into the stages that copy
  from it.
- **Keep your Dockerfiles private.** Everything runs on the pasted text in your browser. Nothing
  is sent to a server, which makes it safe for proprietary builds.
- **Learn the model by watching it.** The hover cascade shows *why* a layer rebuilds, so it works
  as a teaching tool as much as a linter.

## What it detects

| Check | Severity | What it catches |
|-------|----------|-----------------|
| `copy-before-install` | high | A broad `COPY` above a dependency install that busts the install on every edit |
| `apt-no-clean` | medium | `apt-get install` that never removes `/var/lib/apt/lists`, bloating the image |
| `order-sensitivity` | medium | A rarely-changing heavy install placed below a broad `COPY` |
| `avoidable-add` | low | `ADD` used for a plain local file where `COPY` is clearer and safer |
| `floating-base-image` | low | `FROM` on `:latest` or an untagged image, so rebuilds are not reproducible |
| `missing-dockerignore` | low | A broad `COPY` with no `.dockerignore` hint |

A clean, well-ordered Dockerfile produces no suggestions. Layerlens stays quiet when there is
nothing to say.

## Using it

Open the [live demo](https://apps.charliekrug.com/layerlens/) and you get a two-pane workbench:

- **Left, the editor.** A line-numbered Dockerfile editor seeded with a sample. Type or paste and
  the analysis re-renders live. Malformed input surfaces a parse note, never a blank page.
  One-click examples (Node, Python, Go multi-stage) load into the editor.
- **Right, the schematic.** The layer stack, grouped and labeled by build stage, each bar sized by
  relative weight and tinted by cache state. Two headline metrics roll to their values: relative
  image weight and the percent that rebuilds on a routine source edit.
- **Hover a layer** to run the cache-cascade sweep. Optional synthesized sound effects (off by
  default, the toggle persists) tick and clunk as the cache breaks.
- **Suggestions** dock beneath the stack as annotations tied to their line.

## Run it locally

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests: core + UI renderers + happy-dom workbench integration
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # static site in dist/, safe to serve under any subpath
```

## How it works

Layerlens is a pure reasoning core with a thin UI over it:

```
Dockerfile text
  -> parseDockerfile()   instruction stream (line continuations, heredocs, multi-stage FROM)
  -> buildLayers()       each instruction to a modeled layer + relative size weight
  -> analyzeLayers()     cache cascade, headline metrics, ranked suggestions
  -> renderers + workbench   live DOM, hover sweep, rolling counters, sound
```

The core is dependency-free and unit-tested in isolation from the DOM. Size and cache figures are
honest *relative* heuristics, never claimed byte sizes, because real sizes need a real build.
See [`docs/VISION.md`](docs/VISION.md) for the rationale, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the codebase map, and [`docs/DESIGN.md`](docs/DESIGN.md) for the visual direction.

## Stack

TypeScript with a hand-written Dockerfile-instruction parser, zero runtime dependencies in the
core. Vite builds the static site; Vitest and fast-check cover the logic. Ships as one
self-contained static page, hostable under any base path.

## License

MIT © ctkrug. See [`LICENSE`](LICENSE).

---

More of Charlie's projects → https://apps.charliekrug.com
