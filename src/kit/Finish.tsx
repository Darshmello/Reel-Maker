// Finish over the 3D: fine grain only (it stops the sky gradient banding after the platform
// recompresses). No bloom, no vignette: the approved style frame is clean.
import React, {useMemo} from 'react';
import {AbsoluteFill, random} from 'remotion';

const useGrain = () =>
  useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const d = g.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 128 + (random(`grain${i}`) - 0.5) * 255;
      d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
      d.data[i * 4 + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL();
  }, []);

export const Finish: React.FC<{fr: number; amount?: number}> = ({fr, amount = 0.035}) => {
  const grain = useGrain();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${grain})`,
        backgroundPosition: `${Math.floor(random(`gx${fr}`) * 256)}px ${Math.floor(random(`gy${fr}`) * 256)}px`,
        mixBlendMode: 'overlay',
        opacity: amount,
        pointerEvents: 'none',
      }}
    />
  );
};
