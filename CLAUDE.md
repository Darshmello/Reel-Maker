# reels-studio — project rules

Code-rendered low-poly pastel 3D "what if" Reels. Remotion + three.js. No AI video models, no Blender.
Plan: `C:\Users\darsh\.opencode\plan\reels-3d-pipeline-plan.md`.

## Delivery spec
- 1080x1920, 9:16, 30 fps, every still and every render.
- H.264 High, yuv420p, CRF 18; AAC 48 kHz 192 kbps; MP4 +faststart.
- -14 LUFS integrated, true peak <= -1.5 dBTP (two-pass loudnorm in `scripts/render.ps1`).
- Frame 0 is the cover: legible at phone size and already in motion.

## Determinism (non-negotiable)
- No `Math.random()`, `Date.now()`, `performance.now()` or any clock. Use `random(seed)` from `remotion`.
- Every animated value derives from `useCurrentFrame()` via `interpolate()` / helpers in `src/kit`.
- Absolute frame numbers only. No nested `<Sequence>` offsets.
- All procedural seeds come from the spec (`ideas.json` / composition props).
- three.js: build geometry once (stable `build` passed to `kit/ThreeCanvas`), per frame only move things.
- Every cue time comes from `cue('anchor phrase')` over `src/film/words.json`, so a new VO re-times the film.

## Safe zones (Reels UI)
- Nothing important above y=220 or below y=1500.
- Right rail: avoid x>930 where y>1100.
- Title block centred at y=560 (max 2 lines). Counter baseline y=1400. Captions (if used) y=1180-1340.

## Palette and look
- All colours come from `src/style/lowpoly/palette.ts`. No hex literals in scene/kit files.
- Set packs (`src/sets/<id>/`) keep their own colours in their own `palette.ts`; hex nowhere else in a pack.
  Packs import only `../kit`, `../types` and their own files. `node scripts/check-set.mjs <id>` enforces this.
- MeshLambertMaterial with `flatShading: true` everywhere; `toNonIndexed()` if a primitive still smooths.
- Pastel and quiet; exactly one saturated accent (the bridge, `PALETTE.bridge` / per-video accent).
- Light: sun #FFF6E8 x2.2 at (30,50,20), shadow map 2048 tight on the hero block; hemisphere
  #BFD9F2/#6FA35C x0.8; Fog(skyHorizon, 80, 220); SRGBColorSpace output, NoToneMapping.
- Camera: vertical FOV 24 deg, height 3.4 m, tilt -10 deg. One move per act. No DOF, no bloom.
- The set is a model (diorama scale, buildings ~0.5-3 m) so the 3.4 m long-lens camera reads it as a miniature.
- When in doubt: remove elements, don't add them.

## Commands
- Typecheck: `npx tsc -p .`
- Still: `npx remotion still WhatIf out/x.png --frame=0`
- Full film: `powershell -File scripts/render.ps1 <slug>`; batch: `powershell -File scripts/batch.ps1`
