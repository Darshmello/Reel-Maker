// Serif title block, centred on y=560 (Reels safe band), at most two lines, white with a soft shadow.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {loadFont} from '@remotion/google-fonts/EBGaramond';
import {PALETTE} from '../style/lowpoly/palette';

export const {fontFamily: SERIF} = loadFont('normal', {weights: ['500', '600'], subsets: ['latin']});

export const TITLE_Y = 560;

export const Title: React.FC<{text: string; opacity: number; rise?: number}> = ({text, opacity, rise = 0}) => {
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 110,
          right: 110,
          top: TITLE_Y,
          transform: `translateY(calc(-50% + ${rise}px))`,
          textAlign: 'center',
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 76,
          lineHeight: 1.12,
          color: PALETTE.text,
          textShadow: `0 2px 14px ${PALETTE.textShadow}`,
          opacity,
          // never more than two lines
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textWrap: 'balance',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
