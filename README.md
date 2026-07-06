# Layerlens

[![CI](https://github.com/ctkrug/layerlens/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/layerlens/actions/workflows/ci.yml)

**Paste a Dockerfile. See exactly how it builds.**

Layerlens is a static analyzer for Dockerfiles. It reads the build the way the Docker
daemon does — one instruction, one layer at a time — and renders a visual, layer-by-layer
breakdown of **image size** and **cache invalidation**, then hands you concrete, ranked
suggestions to shrink the image and speed up rebuilds.

No daemon. No `docker build`. No uploading your source anywhere. It reasons about the build
model *statically*, entirely in your browser.

> ⚡ **The wow:** paste a real-world Dockerfile and Layerlens instantly highlights the
> cache-busting chain — the exact `COPY . .` that invalidates your dependency install on every
> code change — and shows the one-line reorder that fixes it, with the estimated rebuild-time
> saved.

---

## Why

Docker's layer cache is the single biggest lever on rebuild speed, and almost every hand-written
Dockerfile leaves it on the floor:

- `COPY . .` *before* `RUN npm install` busts the dependency layer on every source edit.
- A `RUN apt-get update && apt-get install` that never cleans its `apt` lists bloats the image.
- Ordering a rarely-changing instruction *after* a frequently-changing one throws away cache
  for everything downstream.

These are mechanical, statically-detectable mistakes — but you only feel them as "why is my
build slow again?" Layerlens makes the invisible build model **visible**.

## What it does

- **Parses** a Dockerfile into its instruction stream, honoring line continuations, comments,
  parser directives, `ARG`/`ENV` semantics, and multi-stage `FROM ... AS` boundaries.
- **Maps instructions to layers** — which instructions create a filesystem layer, which are
  metadata-only, and the estimated size weight of each.
- **Models the cache chain** — for any change (a source file, a build arg), which layers stay
  cached and which rebuild, cascading downstream exactly as Docker would.
- **Suggests fixes** — concrete, ranked reorderings and rewrites ("move `COPY package.json`
  above `RUN npm ci`") with the estimated impact on rebuild time and image size.
- **Visualizes** all of it as a schematic: a stacked layer diagram you can hover to trace the
  cache cascade.

## Stack

- **TypeScript**, zero runtime dependencies in the core analyzer.
- A hand-written **Dockerfile-instruction parser** (no shelling out to Docker).
- **Vite** for the static web build; **Vitest** for tests.
- Ships as a single self-contained static site — hostable under any base path.

## Status

Early. This repo currently holds the plan and the scaffold. See [`docs/VISION.md`](docs/VISION.md)
for the design and [`docs/BACKLOG.md`](docs/BACKLOG.md) for the epic/story breakdown.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # run the unit tests
npm run build    # produce the static site in dist/
```

## License

MIT © ctkrug. See [`LICENSE`](LICENSE).
