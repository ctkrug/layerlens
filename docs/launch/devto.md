---
title: "Layerlens: seeing your Docker build cache without running docker build"
published: false
tags: docker, typescript, webdev, devtools
---

Every Dockerfile I have ever written started fast and got slow. Not the container, the
*rebuild*. You change one line of source, and suddenly `npm ci` runs again and you are watching
a progress bar you thought you had cached away months ago. The cause is almost always the same,
and it is mechanical: a `COPY . .` sitting above the install, so any file change invalidates the
layer underneath it.

The frustrating part is that this is completely knowable from the Dockerfile text. You do not
need to run the build to see it. So I built [Layerlens](https://apps.charliekrug.com/layerlens/),
a static Dockerfile analyzer that runs in the browser: paste a Dockerfile, see the layer stack,
see which layers rebuild on a code change, and get the exact reorder that fixes it. No daemon, no
`docker build`, nothing uploaded.

Two build decisions were more interesting than I expected.

## Modeling the cache without a builder

Docker's cache rule is simple to state: each layer's cache key depends on the instruction plus
the layer before it, so invalidating a layer invalidates every layer after it in the same stage.
The tricky bit is multi-stage builds. Stages are independent lineages, but `COPY --from=build`
stitches them together: if the `build` stage's output changes, every `COPY --from=build` breaks,
and the cascade continues into the stage that did the copy.

That makes the cascade a small fixpoint. I seed the layers a change touches, then repeatedly walk
every `COPY --from` edge and pull in the consumer layer if the stage it reads from is already
invalidated, until nothing new gets added:

```ts
let changed = true;
while (changed) {
  changed = false;
  for (const l of layers) {
    if (l.instruction.keyword !== 'COPY') continue;
    const target = crossStageTarget(l.instruction.args, names);
    if (target !== null && stageFrom.has(target) && seed(l.index)) changed = true;
  }
}
```

The same function powers both the "percent that rebuilds on a source edit" metric and the hover
interaction on the page, where you mouse over a layer and watch the exact set it would bust light
up. One model, two consumers.

## Relative weights, not fake megabytes

The obvious feature request is "tell me how many MB each layer is." I decided not to lie. Real
byte sizes require an actual build; there is no honest way to get them from static text. So
Layerlens reports *relative* weights inferred from instruction semantics. A package install
weighs a lot, a broad `COPY` weighs a lot, an `ENV` weighs nothing. The numbers are meaningful
next to each other, and the UI never prints a unit it cannot back up. That constraint made the
tool more useful, not less, because it forced every suggestion to be about order and structure
rather than a number I would have had to fake.

## What I would do differently

The parser is hand-written, and Dockerfiles have more edge cases than you would think: line
continuations, the `escape` directive, comments inside continuations, and BuildKit heredocs
(`RUN <<EOF ... EOF`) whose bodies are literal shell, not instructions. I found several of these
only after property-testing the parser with fast-check to assert it never throws and always
returns bounded metrics on random input. If I started over, I would write those property tests
first, because they caught real bugs faster than the example-based ones did.

The core is dependency-free and DOM-free, so all of it tests in plain Node, with the UI as a thin
renderer on top. Core-logic coverage sits around 99%.

Try it: [apps.charliekrug.com/layerlens](https://apps.charliekrug.com/layerlens/)
Source: [github.com/ctkrug/layerlens](https://github.com/ctkrug/layerlens)

If you have a gnarly Dockerfile that fools it, I would genuinely like to see it.
