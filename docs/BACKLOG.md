# Layerlens — Backlog

Epic/story breakdown for the build. Each story has concrete, verifiable acceptance criteria a
later run can confirm true or false. Stories are `[ ]` until their criteria are met and merged.

Legend: **AC** = acceptance criteria.

---

## Epic 1 — The live analysis workbench (the wow)

Paste a Dockerfile, see it build. This epic delivers the demo before anything optional.

- [x] **1.1 — WOW: live editor + layer stack that highlights the cache-busting chain**
      _The demo the whole project lands on._ A two-pane workbench: paste/edit a Dockerfile on the
      left, see the layer stack on the right update live.
  - **AC1:** Editing the Dockerfile text re-renders the layer stack and metrics within one frame,
    with no page reload.
  - **AC2:** For the default sample, the layers at/after the broad `COPY . .` are visually marked
    as "rebuilds on source edit" (danger tint), and the top suggestion names the exact line to move
    and states an estimated rebuild-time saving (e.g. "≈ skips re-running `npm ci`").
  - **AC3:** Pasting invalid/garbage text shows a designed inline notice, not a crash or blank page.

- [x] **1.2 — Cache-cascade hover sweep (signature detail)**
  - **AC1:** Hovering or keyboard-focusing a layer runs a ≤250ms sweep that highlights every
    downstream layer that layer's change would invalidate.
  - **AC2:** The "rebuilds on edit %" metric reflects the hovered layer's cascade while hovered and
    restores on blur.
  - **AC3:** With `prefers-reduced-motion`, the highlight is applied without animation.

- [x] **1.3 — Headline metrics with rolling counters**
  - **AC1:** Two metrics render — relative image weight and % that rebuilds on a routine source
    edit — both derived from the core analyzer, not hard-coded.
  - **AC2:** On analyze, numbers roll to their value; with reduced-motion they snap.

- [x] **1.4 — Design polish: workbench**
  - **AC1:** At 390 / 768 / 1440px the panes compose with no horizontal scroll and no tiny widget
    adrift in empty space; the stack is the viewport hero (≥60vh desktop).
  - **AC2:** Editor textarea, buttons, and any select are themed (hover/focus-visible/active), not
    native defaults; the blueprint grid fills to the edges.

---

## Epic 2 — Deeper, trustworthy analysis

Make the reasoning cover the anti-patterns people actually hit, across multi-stage builds.

- [x] **2.1 — Expanded suggestion ruleset**
  - **AC1:** Detects at least four more patterns beyond the two shipped: order-sensitivity
    (frequently-changing instruction above a rarely-changing one), `ADD` of a local file that
    should be `COPY`, `FROM` on a floating `latest`/no tag, and a missing-`.dockerignore` hint when
    a broad `COPY .` is present.
  - **AC2:** Each suggestion carries a stable `id`, a severity, the concerning line, and a concrete
    one-sentence fix — asserted by unit tests over fixture Dockerfiles.
  - **AC3:** A clean, well-ordered Dockerfile produces zero false positives (verified by a
    "good Dockerfile" fixture test).

- [x] **2.2 — Multi-stage build awareness**
  - **AC1:** The stack visually groups layers by build stage and labels each stage (`FROM ... AS`
    name when present).
  - **AC2:** `COPY --from=<stage>` is shown as a cross-stage edge, and only the final stage's
    layers count toward the shipped-image weight metric.

- [x] **2.3 — Size & rebuild estimate model**
  - **AC1:** Size weights are documented and unit-tested such that heavier operations
    (package installs, broad copies) rank above lighter ones deterministically.
  - **AC2:** The top suggestion's "estimated saving" is computed from the model (weight of the
    layers that would stay cached), not a fixed string.

- [x] **2.4 — Design polish: suggestion annotations**
  - **AC1:** Suggestions read as margin annotations tied to their line (severity color-coded per
    tokens); empty state ("no issues found") is designed, not blank.

---

## Epic 3 — Ship-ready static site

Package it as one self-contained blueprint that hosts under any base path.

- [x] **3.1 — Landing page (`site/` or root hero) matching the brand**
  - **AC1:** A hero states the wow in one line, shows an inline/static demo of the layer stack, and
    links to the app — using the exact DESIGN.md direction and tokens (one brand, not two).
  - **AC2:** Built output uses only relative asset paths and works when served from a subpath.

- [x] **3.2 — Example gallery of real-world Dockerfiles**
  - **AC1:** At least three one-click examples (e.g. a Node app, a Python app, a Go multi-stage
    build) load into the editor and each surfaces at least one suggestion.

- [x] **3.3 — Optional synth SFX with persisted mute**
  - **AC1:** A subtle WebAudio-synth tick on layer hover and a "clunk" on cascade, generated in
    code (no audio files), off/mute toggle persisted in `localStorage`.
  - **AC2:** AudioContext is created lazily on first gesture and guarded so tests/no-audio
    environments don't throw.

- [x] **3.4 — Responsiveness, a11y & final design pass**
  - **AC1:** Passes the DESIGN.md D3 self-review at 390/768/1440; focus visible on every control;
    icon-only buttons have `aria-label`; status text uses a live region.
  - **AC2:** Color contrast ≥ 4.5:1 for text; touch targets ≥ 44px.

---

**Story count: 12** (across 3 epics). The wow (1.1) is the first story of the first epic and is
reachable with the core analyzer that already exists.
