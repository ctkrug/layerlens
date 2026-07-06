# Layerlens — Vision

## The problem

Docker's layer cache is the biggest single lever on build speed and image size, and it is almost
entirely invisible. A developer writes a Dockerfile top to bottom, it works, and they never see
that:

- their `COPY . .` sits *above* `RUN npm ci`, so every one-character source edit re-downloads
  every dependency;
- their `apt-get install` never cleans `/var/lib/apt/lists`, so hundreds of MB of package
  metadata ships to production;
- a rarely-changing instruction sits below a frequently-changing one, discarding cache for
  everything downstream.

These are mechanical, statically-detectable mistakes. But the only feedback loop today is
"my build feels slow," and the only tools require actually running `docker build` — which needs a
daemon, the real build context, and a wait. There is no fast, safe, zero-setup way to *see* the
build model and where it leaks.

## Who it's for

- Developers who wrote a working Dockerfile and suspect it's slower or fatter than it should be.
- People reviewing someone else's Dockerfile in a PR who want a second opinion in five seconds.
- Anyone learning how Docker layer caching actually works — Layerlens is a teaching tool as much
  as a linter, because it *shows* the cascade instead of just naming the rule.

## The core idea

**Statically model the Docker build and render it.** Parse the Dockerfile into its instruction
stream, map each instruction to a layer, estimate relative size weights from semantics, and model
the cache-invalidation cascade — all without ever running Docker. Then present it as a blueprint:
a visual layer stack you can hover to watch the cache break, plus concrete, ranked fixes.

The differentiator is that reasoning about caching semantics and size deltas *without executing
the build* requires genuinely understanding the build model — line continuations, multi-stage
boundaries, which instructions create layers, what busts a cache key. That understanding is the
product.

## Key design decisions

- **No daemon, no execution, no upload.** Everything runs in the browser on pasted text. Safe for
  proprietary Dockerfiles; instant; hostable as a static site under any base path.
- **Relative, honest estimates.** Real byte sizes need a real build. Layerlens never claims exact
  MB; it gives *relative* size weights and clearly-labeled heuristics, so it's useful without
  lying. (A future story may let users paste `docker history` output to calibrate.)
- **Pure, testable core.** The parser → layer model → analyzer pipeline is dependency-free and
  unit-tested in isolation from the UI. The UI is a thin renderer over it.
- **Suggestions must be concrete and ranked.** Not "consider caching" but "move the `COPY` on
  line 8 below `RUN npm ci` on line 11," ordered by severity. Vague advice is a defect.
- **The blueprint direction is the brand.** See [`DESIGN.md`](DESIGN.md). Product and landing page
  are one schematic.

## What "v1 done" looks like

- Paste (or edit) any real-world Dockerfile and get, live:
  - a layer stack visualizing each layer's relative size weight and cache state;
  - the two headline metrics — relative image weight and % that rebuilds on a routine source edit;
  - a hover interaction that shows the cache cascade a change would trigger (the signature detail);
  - a ranked list of concrete suggestions covering at least the headline anti-patterns
    (COPY-before-install, uncleaned package managers, order-sensitivity, missing `.dockerignore`
    hints, avoidable `ADD`).
- Handles the tricky parse cases: line continuations, the escape directive, comments inside
  continuations, multi-stage `FROM ... AS`, `--from=` copies.
- Ships as a static site with a matching landing page, responsive from 390px to 1440px, meeting
  the design bar in `DESIGN.md`.
- Green CI: typecheck, lint, unit tests, build.
