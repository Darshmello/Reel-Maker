// The film shell: 3D set + title card, act labels, counter, end card and the mixed audio.
// Every time comes from beats (cue phrases over the aligned VO words). Absolute frames throughout.
import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {makeBeats, REWIND, Spec, Word} from './beats';
import {S01_City} from '../scenes/S01_City';
import {Title} from '../kit/Title';
import {Counter, formatNumber} from '../kit/Counter';
import {Finish} from '../kit/Finish';
import {PALETTE} from '../style/lowpoly/palette';

export type FilmProps = {spec: Spec; words: Word[]; audio: string | null};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.45, 0, 0.55, 1);
// opacity for a window [a, b) with fades; fadeIn 0 means fully on at `a` (the cover frame)
const win = (fr: number, a: number, b: number, fadeIn = 6, fadeOut = 8) =>
  Math.min(fadeIn ? interpolate(fr, [a, a + fadeIn], [0, 1], clamp) : fr >= a ? 1 : 0, interpolate(fr, [b - fadeOut, b], [1, 0], clamp));

export const Film: React.FC<FilmProps> = ({spec, words, audio}) => {
  const fr = useCurrentFrame();
  const beats = useMemo(() => makeBeats(spec, words), [spec, words]);
  const {acts, endStart, total} = beats;
  const firstAct = acts[0]?.start ?? endStart;

  // title card is on at frame 0 (the cover) and leaves as act 1 opens; act labels hold ~2.5 s
  const titles: {text: string; o: number; rise: number}[] = [
    {text: spec.title, o: win(fr, 0, firstAct, 0, 8), rise: 0},
    ...acts.map((a) => ({text: a.label, o: win(fr, a.start, Math.min(a.start + 78, a.end)), rise: interpolate(fr, [a.start, a.start + 10], [14, 0], {...clamp, easing: ease})})),
    {text: spec.end.title, o: win(fr, endStart + REWIND - 4, total + 1, 8, 1), rise: interpolate(fr, [endStart + REWIND - 4, endStart + REWIND + 8], [14, 0], {...clamp, easing: ease})},
  ];
  const act = acts.find((a) => fr >= a.start && fr < a.end);
  let counter = null;
  if (act) {
    const c = act.counter;
    const t = interpolate(fr, [act.fxStart, act.fxEnd], [0, 1], {...clamp, easing: ease});
    const v = c.from + (c.to - c.from) * t;
    counter = <Counter label={c.label} value={`${c.prefix ?? ''}${formatNumber(v, c.decimals ?? 0)}${c.suffix ?? ''}`} opacity={win(fr, act.start + 4, act.end - 2)} />;
  }

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.skyHorizon}}>
      <S01_City beats={beats} fr={fr} />
      <Finish fr={fr} />
      {titles.map((t, i) => (
        <Title key={i} text={t.text} opacity={t.o} rise={t.rise} />
      ))}
      {counter}
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
