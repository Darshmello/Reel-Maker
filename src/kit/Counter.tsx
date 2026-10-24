// Animated number with tabular figures, baseline exactly on y=1400 (drawn as SVG text so the
// baseline is the alphabetic baseline, not a line box). Small label above it.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PALETTE} from '../style/lowpoly/palette';
import {SERIF} from './Title';

export const COUNTER_BASELINE = 1400;

// Deterministic formatting (no locale lookups): thousands separators, fixed decimals.
export const formatNumber = (v: number, decimals = 0) => {
  const neg = v < 0;
  const [int, frac] = Math.abs(v).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac ? `.${frac}` : '');
};

export const Counter: React.FC<{label: string; value: string; opacity: number}> = ({label, value, opacity}) => {
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <filter id="counter-shadow" x="-20%" y="-50%" width="140%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="7" floodColor={PALETTE.textShadow} floodOpacity="1" />
          </filter>
        </defs>
        <g filter="url(#counter-shadow)" fill={PALETTE.text} textAnchor="middle" fontFamily={SERIF}>
          <text x={540} y={COUNTER_BASELINE - 66} fontSize={26} fontWeight={600} letterSpacing="0.16em">
            {label.toUpperCase()}
          </text>
          <text x={540} y={COUNTER_BASELINE} fontSize={56} fontWeight={600} style={{fontVariantNumeric: 'tabular-nums lining-nums'}}>
            {value}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
