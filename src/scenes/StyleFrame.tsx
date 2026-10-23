// M1 style frame: the city from the default camera, nothing animated.
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {ThreeCanvas, Stage} from '../kit/ThreeCanvas';
import {PALETTE} from '../style/lowpoly/palette';
import {SET, buildCity} from '../style/lowpoly/city';
import {LIGHT, addLights, skyTexture} from '../style/lowpoly/light';

export const CAM = {fov: 24, height: 3.4, tilt: -10};

export const StyleFrame: React.FC<{seed: string; camZ: number; sun?: number; hemi?: number}> = ({seed, camZ, sun = LIGHT.sun, hemi = LIGHT.hemi}) => {
  const build = useMemo(
    () => (): Stage => {
      const scene = new THREE.Scene();
      scene.background = skyTexture(0.09);
      const city = buildCity({seed, accent: PALETTE.bridge});
      scene.add(city.group);
      addLights(scene, SET.hero, 7, {sun, hemi});
      const camera = new THREE.PerspectiveCamera(CAM.fov, 1080 / 1920, 0.1, 400);
      camera.position.set(0, CAM.height, camZ);
      camera.rotation.set(THREE.MathUtils.degToRad(CAM.tilt), 0, 0);
      return {scene, camera};
    },
    [seed, camZ, sun, hemi],
  );
  return <ThreeCanvas fr={useCurrentFrame()} build={build} />;
};
