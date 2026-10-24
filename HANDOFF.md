# Handoff: state of reels-studio (2026-10-24)

Read this first, then `CLAUDE.md` (hard rules) and `README.md` (usage). Original plan:
`C:\Users\darsh\.opencode\plan\reels-3d-pipeline-plan.md`.

## What this is
One prompt -> a finished 1080x1920 low-poly pastel "what if" Reel. three.js geometry rendered by Remotion,
edge-tts placeholder voice, faster-whisper alignment, synthesized mix, two-pass loudnorm, 16-check QA.
No AI video models, no Blender, no paid services, no API keys. Nothing is ever posted.

## Git
- Repo: https://github.com/Darshmello/Reel-Maker (remote `origin`).
- Current branch `plan-review` (4 commits not pushed). `main` is 2 commits ahead of `origin/main`.
  Nothing on either has been pushed since `cc1e9a7`. Ask the user before pushing or merging.

## Built so far
- Pipeline M0-M4 done: `scripts/render.ps1 <slug>`, `scripts/batch.ps1`, `scripts/qa.py`. Films in `ideas.json`;
  outputs `out/<slug>.mp4` (gitignored). Re-renders are byte-identical (verified with baseline stills in
  `out/baseline/` after every refactor).
- Studio (`npm run studio` -> http://127.0.0.1:4321, zero deps, `studio/server.mjs`): dashboard with Home,
  Create, Films, Sets and Docs. Server answers only its own page (Host + Origin + JSON content-type checks).
- Writers = the user's own CLI agents (`studio/agents.json`, local choice in `studio/agents.local.json`):
  Claude Code (`claude -p`), opencode (`opencode run -f {promptFile}`), Codex, Gemini, custom, offline draft.
  `studio/generate.mjs` turns a brief into a plan/spec (dynamic 1-5 acts, scene, set, shot per act), validates,
  retries once.
- Create flow (from the other session): brief -> drafted plan -> review card -> Generate (saves + renders),
  live writer log.
- Set packs = the "marketplace": `src/sets/<id>/{index.ts,palette.ts,meta.json}` against `src/sets/types.ts`
  (SetBuild contract) using `src/sets/kit.ts`. `city-bridge` adapts the approved M1 city. Registry is generated:
  `node scripts/sets-registry.mjs` -> `src/sets/registry.ts`.
  - `node scripts/check-set.mjs <id>`: lint (hex only in palette.ts, no Math.random/Date/DOM/network, imports
    only ../kit, ../types, own files), typecheck (only this pack's errors count), render cover + probe
    (blackout, towers, crowd, rockets) to `out/sets/<id>/`.
  - `studio/setgen.mjs` / `node studio/setgen.mjs "<place>" <id> [agent]`: agent writes a pack, check, up to
    2 repairs, then one visual self-review (reads its renders). New packs are drafts.
  - `node scripts/seed-sets.mjs [--agent=id] [ids]`, `scripts/thumbs.mjs` re-renders all thumbnails.
  - Packs: city-bridge, desert-pyramids (hand-written reference), tropical-island, alpine-village, harbor-town,
    farmland, canal-city, suburbs, megacity, moon-base, antarctica-station-a/b, you-ran-2x-speed-every-a/b.
- Camera shots per act (`src/kit/Camera.tsx` SHOTS, copy in generate.mjs and app.js): standard, wide, aerial,
  low, orbit-left, orbit-right. Lens fixed at 24 deg. Defaults are byte-identical to the approved look.
- The hero (Darsh figure) appears only when the idea is about Darsh (`spec.hero = 'darsh'`).

## Rules that must not break (also in CLAUDE.md)
- Determinism: no Math.random / Date.now / performance.now; `random(seed)`; absolute frames only.
- Colours only from palette.ts (shared) or the pack's own palette.ts.
- Safe zones: nothing above y=220 or below y=1500; avoid x>930 where y>1100; title y=560; counter baseline y=1400.
- Delivery: H.264 High yuv420p CRF 18, AAC 48k 192k, -14 LUFS, TP <= -1.5 dBTP, +faststart, frame 0 = cover.
- Work only inside C:\Users\darsh\reels-studio. Pin dependency versions. Don't post or publish anything.
- If a spec can't be met as written, say so and propose the alternative before building.
- Report each milestone in two short paragraphs: what changed, what you verified.
- After any change to src/, re-render the stills in out/baseline/ and confirm the md5s still match.

## Known issues / next steps
1. opencode's free model hit "Free usage limit reached" during the seed batch (moon-base log shows it failed;
   a later commit added a hand-built moon-base). Prefer Claude Code, or give opencode a model with -m.
2. Snow counter (white text) is hard to read over snow: add a stronger shadow or scrim in `src/kit/Counter.tsx`.
3. The rain end card says "the sun came out" while it still rains (script choice).
4. Review the draft sets in the Sets page; approve good ones, delete weak ones (only drafts can be deleted).
5. Decide whether to push `main` and merge `plan-review` (ask the user).
6. Machine is low on memory: run one render or one set generation at a time; background servers get killed.
