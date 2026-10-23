// three.js <-> Remotion bridge. One WebGL canvas per mount; the scene is built once by `build`
// (pass a stable function: module-level or useMemo'd) and redrawn synchronously for every frame.
// The first frame is held with delayRender until it has actually been drawn, so a render worker
// never captures an empty canvas. No clocks: the only time input is `fr`.
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, useVideoConfig} from 'remotion';
import * as THREE from 'three';

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  update?: (fr: number) => void;
  dispose?: () => void;
};

export const ThreeCanvas: React.FC<{fr: number; build: (r: THREE.WebGLRenderer) => Stage}> = ({fr, build}) => {
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<{r: THREE.WebGLRenderer; stage: Stage} | null>(null);
  const [handle] = useState(() => delayRender('three: first draw'));
  const released = useRef(false);

  useLayoutEffect(() => {
    const r = new THREE.WebGLRenderer({canvas: ref.current!, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    const stage = build(r);
    ctx.current = {r, stage};
    return () => {
      stage.dispose?.();
      r.dispose();
      ctx.current = null;
    };
  }, [build, width, height]);

  useLayoutEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.stage.update?.(fr);
    c.r.render(c.stage.scene, c.stage.camera);
    c.r.getContext().finish();
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [fr, build, width, height, handle]);

  return <canvas ref={ref} width={width} height={height} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />;
};
