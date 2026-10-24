// M2 check: one act, 8 s. Dolly z=12 -> z=4 ease-in-out over the approved set, title card and counter.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {ThreeCanvas, Stage} from '../kit/ThreeCanvas';
import {camAt, CamKey, makeCamera, placeCamera} from '../kit/Camera';
import {Title} from '../kit/Title';
import {Counter, formatNumber} from '../kit/Counter';
import {Finish} from '../kit/Finish';
import {PALETTE} from '../style/lowpoly/palette';
import {SET, buildCity} from '../style/lowpoly/city';
import {addLights, skyTexture} from '../style/lowpoly/light';

const KEYS: CamKey[] = [[0, {x: 0, z: 12}], [240, {x: 0, z: 4}]];

const build = (): Stage => {
  const scene = new THREE.Scene();
  scene.background = skyTexture(0.09);
  scene.add(buildCity({seed: 'city-01', accent: PALETTE.bridge}).group);
  addLights(scene, SET.hero);
  const camera = makeCamera();
  return {scene, camera, update: (fr) => placeCamera(camera, camAt(fr, KEYS))};
};

export const M2Dolly: React.FC = () => {
  const fr = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ThreeCanvas fr={fr} build={build} />
      <Finish fr={fr} />
      <Title text="What if the city stood still?" opacity={interpolate(fr, [150, 170], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      <Counter label="Camera distance" value={`${formatNumber(camAt(fr, KEYS).z, 1)} m`} opacity={1} />
    </AbsoluteFill>
  );
};
