// Keyed camera moves for the three.js set. The camera's lens, height and tilt are the style spec and
// never change; a move only changes its ground position (x, z): dolly, truck or a diagonal of both.
import {Easing, interpolate} from 'remotion';
import * as THREE from 'three';

export const CAM = {fov: 24, height: 3.4, tilt: -10};
export type CamPos = {x: number; z: number};
export type CamKey = [frame: number, pos: CamPos];

const inOut = Easing.bezier(0.45, 0, 0.55, 1);

// Position at absolute frame `fr`: holds before the first key and after the last, eases between.
export const camAt = (fr: number, keys: CamKey[]): CamPos => {
  if (fr <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [k0, a] = keys[i - 1];
    const [k1, b] = keys[i];
    if (fr < k1) {
      const t = interpolate(fr, [k0, k1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut});
      return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t};
    }
  }
  return keys[keys.length - 1][1];
};

export const makeCamera = () => {
  const c = new THREE.PerspectiveCamera(CAM.fov, 1080 / 1920, 0.1, 400);
  c.rotation.set(THREE.MathUtils.degToRad(CAM.tilt), 0, 0);
  return c;
};

export const placeCamera = (c: THREE.PerspectiveCamera, p: CamPos) => {
  c.position.set(p.x, CAM.height, p.z);
  c.updateMatrixWorld();
};
