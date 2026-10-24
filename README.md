# reels-studio

One sentence in, a 1080x1920 low-poly "what if" Reel out. Every frame is three.js geometry drawn by
Remotion from code: deterministic, re-renderable, batchable. No AI video models, no Blender.

## Audio is a placeholder

- **Voiceover:** generated with edge-tts (Microsoft neural voices, free, no key) by
  `scripts/make_vo.py`. To use a real recording, drop it at `public/vo/<slug>.user.wav` (or `.mp3`)
  and re-run the render: alignment and every cue re-time automatically.
- **Music bed and sound effects:** synthesized in numpy by `scripts/mix.py` (pad, plucks, whooshes,
  rumbles, rocket roars, server clicks, a notification ping). All synthetic, timed from the same
  events the picture uses.

## Make a film

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render.ps1 <slug>     # one entry of ideas.json
powershell -ExecutionPolicy Bypass -File scripts/batch.ps1             # every entry
```

Output: `out/<slug>.mp4`. Each run ends with QA (`scripts/qa.py`): ffprobe against the delivery
spec, -14 LUFS / -1.5 dBTP, text-pixel safe-zone check on sampled frames, frame-0 motion,
re-render determinism and sequence-vs-still consistency. Overlays: `out/<slug>/qa_safe.png`; cover
at phone size: `out/<slug>/qa_cover300.png`.

## Add a film without touching code

Append an entry to `ideas.json`: slug, seed, title, accent (`red|orange|teal|violet|mustard`), weather
(`clear|overcast|golden`), hero (`darsh` or `null`), voice (any edge-tts voice), duration, intro, three
acts and an end card. Each act picks one change from the library (`towers`, `blackout`, `rockets`,
`water`, `crowd`, `snow`, `rain`), its anchor phrase (where it starts in the VO), a label, a counter
and where its single camera move ends.

## Pipeline

1. `make_vo.py` - placeholder VO, lines spaced so narration ends 1.6 s before the cut
2. `align.py` - faster-whisper word timings mapped onto the script's spelling -> `out/<slug>/words.json`
3. `dump-events.mjs` - runs `src/film/beats.ts` under Node: resolves every `cue('anchor')`, writes sound events
4. `mix.py` - VO + bed (ducked by phrase) + effects at their event frames
5. Remotion render (`WhatIf`, props from `props.mjs`) -> two-pass loudnorm + limiter -> `+faststart`
6. `qa.py`

Stills board for approval: `.venv\Scripts\python scripts/board.py <slug> 0 4.5 9 ...`

## Setup on a new machine

```powershell
npm ci
py -V:Astral\CPython3.12.12 -m venv .venv   # any Python 3.11/3.12
.venv\Scripts\python -m pip install -r scripts/requirements.txt
```

Rules for editing (determinism, safe zones, palette) are in `CLAUDE.md`.
