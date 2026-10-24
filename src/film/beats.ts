// The cue table. Every time in the film comes from cue('anchor phrase') over the aligned VO words,
// so swapping the VO re-times the whole film. Pure module (no imports): Remotion bundles it, and
// scripts/dump-events.mjs runs it under plain Node to hand the same sound events to the mixer.

export const FPS = 30;

export type Word = {w: string; s: number; e: number};
export type ActKind = 'towers' | 'blackout' | 'rockets' | 'water' | 'crowd' | 'snow' | 'rain';
export type CamKey = {x: number; z: number};
export type CounterSpec = {label: string; from: number; to: number; decimals?: number; prefix?: string; suffix?: string};
export type ActSpec = {
  kind: ActKind;
  anchor: string; // phrase in the VO where the act starts
  label: string; // title shown at y=560 as the act opens
  line: string; // narration for this act
  counter: CounterSpec;
  cam: CamKey; // where this act's single camera move ends
  amount?: number; // kind-specific size: water level (m), people, towers, rockets, snow cover
};
export type Spec = {
  slug: string;
  seed: string;
  title: string;
  accent: 'red' | 'orange' | 'teal' | 'violet' | 'mustard';
  weather: 'clear' | 'overcast' | 'golden';
  hero: 'darsh' | null;
  set?: string; // set pack id under src/sets/ (default city-bridge)
  voice: string;
  duration: number; // seconds
  intro: {line: string; anchor: string; cam0: CamKey; cam: CamKey};
  acts: ActSpec[];
  end: {line: string; anchor: string; title: string; rewind?: boolean}; // rewind: world snaps back to the opening and loops
};

export type SoundEvent = {id: string; fr: number; dur?: number; what: string; x?: number};

const NUM: Record<string, string> = {'1': 'one', '2': 'two', '3': 'three', '30': 'thirty', '40': 'forty', '100': 'hundred'};
const norm = (s: string) => {
  const t = s.toLowerCase().replace(/[^a-z0-9']/g, '');
  return NUM[t] ?? t;
};

export const f = (sec: number) => Math.round(sec * FPS);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const makeCue = (words: Word[]) => (phrase: string, nth?: number): number => {
  const p = phrase.split(/\s+/).map(norm);
  const hits: number[] = [];
  for (let i = 0; i + p.length <= words.length; i++) {
    if (p.every((x, j) => norm(words[i + j].w) === x)) hits.push(words[i].s);
  }
  if (nth === undefined && hits.length > 1) throw new Error(`cue "${phrase}" is said ${hits.length} times; pass nth`);
  const s = hits[nth ?? 0];
  if (s === undefined) throw new Error(`cue not found: ${phrase}`);
  return s;
};

export type Act = ActSpec & {
  i: number;
  start: number; // absolute frame the act opens (a beat before its anchor word)
  end: number; // absolute frame the next act (or the end card) opens
  fxStart: number; // the one change runs fxStart -> fxEnd
  fxEnd: number;
  schedule: number[]; // per-item frames: tower rises, lights off, rocket launches
};

export type Beats = ReturnType<typeof makeBeats>;

export const REWIND = 27; // frames for the end-card rewind back to the opening state

export const makeBeats = (spec: Spec, words: Word[]) => {
  const cue = makeCue(words);
  const total = f(spec.duration);
  const lead = 3; // cut a beat before the anchor word
  const introAt = Math.max(0, f(cue(spec.intro.anchor)) - lead);
  const starts = spec.acts.map((a) => f(cue(a.anchor)) - lead);
  const endStart = f(cue(spec.end.anchor)) - lead;
  if (endStart >= total - 30) throw new Error(`end card at ${endStart}f leaves under a second of ${total}f`);
  const acts: Act[] = spec.acts.map((a, i) => {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : endStart;
    const fxStart = start + 12;
    const fxEnd = end - 12;
    const n = Math.max(1, Math.round(a.amount ?? DEFAULT_AMOUNT[a.kind]));
    const items = a.kind === 'towers' ? Math.min(n, 40) : a.kind === 'blackout' ? 24 : a.kind === 'rockets' ? n : 0;
    const span = fxEnd - fxStart;
    const schedule = Array.from({length: items}, (_, j) =>
      a.kind === 'rockets' ? Math.round(fxStart + 24 + (j * (span - 60)) / Math.max(1, items - 1)) : Math.round(fxStart + (j * span * 0.8) / items),
    );
    return {...a, i, start, end, fxStart, fxEnd, schedule};
  });

  // World time. Runs with the film until the end card, then rewinds to the opening state in
  // REWIND frames and plays the opening again, so the last frame loops back to frame 0.
  const rewind = spec.end.rewind ?? false;
  const eff = (fr: number) => {
    if (!rewind || fr < endStart) return fr;
    if (fr < endStart + REWIND) {
      const t = (fr - endStart) / REWIND;
      const k = t * t * (3 - 2 * t);
      return endStart * (1 - k);
    }
    return fr - endStart - REWIND;
  };
  const prog = (e: number, a: Act) => clamp01((e - a.fxStart) / Math.max(1, a.fxEnd - a.fxStart));

  // camera keys in world time: opening drift, then one move per act
  const camKeys: [number, CamKey][] = [[0, spec.intro.cam0], [acts[0]?.start ?? endStart, spec.intro.cam]];
  for (const a of acts) camKeys.push([a.start, camKeys[camKeys.length - 1][1]], [a.end - 6, a.cam]);

  const events: SoundEvent[] = [];
  events.push({id: 'intro', fr: introAt, what: 'opening sting'});
  for (const a of acts) {
    events.push({id: `act${a.i}`, fr: a.start, what: `act opens: ${a.label}`});
    if (a.i === 0 && spec.hero) events.push({id: 'drawer', fr: a.start + 14, what: 'phone into drawer'});
    if (a.kind === 'towers') events.push({id: `towers${a.i}`, fr: a.schedule[0], dur: a.schedule[a.schedule.length - 1] + 40 - a.schedule[0], what: 'buildings rising'});
    if (a.kind === 'blackout') {
      a.schedule.forEach((fr, j) => j % 3 === 0 && events.push({id: `click${a.i}.${j}`, fr, what: 'server light off', x: 0.4}));
      events.push({id: `powerdown${a.i}`, fr: a.schedule[a.schedule.length - 1] + 10, what: 'power down', x: 0.4});
    }
    if (a.kind === 'rockets') a.schedule.forEach((fr, j) => events.push({id: `launch${a.i}.${j}`, fr, dur: 90, what: 'rocket launch', x: ((j % 5) - 2) / 3}));
    if (a.kind === 'water' || a.kind === 'rain') events.push({id: `${a.kind}${a.i}`, fr: a.fxStart, dur: a.fxEnd - a.fxStart, what: a.kind === 'rain' ? 'rain' : 'water rising'});
    if (a.kind === 'crowd') events.push({id: `crowd${a.i}`, fr: a.fxStart, dur: a.fxEnd - a.fxStart, what: 'crowd murmur'});
    if (a.kind === 'snow') events.push({id: `snow${a.i}`, fr: a.fxStart, dur: a.fxEnd - a.fxStart, what: 'winter wind'});
  }
  events.push({id: 'end', fr: endStart, what: 'end card'});
  if (rewind) events.push({id: 'rewind', fr: endStart, dur: REWIND, what: 'rewind'});
  if (rewind && spec.hero) events.push({id: 'ping', fr: endStart + REWIND + 6, what: 'phone notification'});
  // frame the end card's title lands: after the rewind, or right as the end line starts
  const endTitleAt = rewind ? endStart + REWIND - 4 : endStart + 2;

  return {spec, words, cue, total, introAt, acts, endStart, endTitleAt, eff, prog, camKeys, events};
};

export const DEFAULT_AMOUNT: Record<ActKind, number> = {towers: 30, blackout: 24, rockets: 10, water: 1, crowd: 2500, snow: 1, rain: 0.3};
