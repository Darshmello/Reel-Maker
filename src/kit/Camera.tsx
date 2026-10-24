// Keyed camera moves for the three.js set. The lens never changes (24 deg: it is what makes the set read
// as a model). The default shot is the approved style: 3.4 m high, tilted -10 deg, moving only on the
// ground (x, z). A shot may also set a height, a tilt and a yaw (an orbit around the hero point), so acts
// can be aerial, low or seen from the side; a key without them is exactly the default shot.
import {Easing, interpolate} from 'remotion';
import * as THREE from 'three';

export const CAM = {fov: 24, height: 3.4, tilt: -10};
export const FOCUS = {x: 0, z: -6}; // the hero point every set is framed around; orbits turn about it
export type CamPos = {x: number; z: number; h?: number; tilt?: number; yaw?: number};
export type CamKey = [frame: number, pos: CamPos];

const inOut = Easing.bezier(0.45, 0, 0.55, 1);
const angled = (p: CamPos) => p.h !== undefined || p.tilt !== undefined || p.yaw !== undefined;

// Position at absolute frame `fr`: holds before the first key and after the last, eases between.
export const camAt = (fr: number, keys: CamKey[]): CamPos => {
  if (fr <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [k0, a] = keys[i - 1];
    const [k1, b] = keys[i];
    if (fr < k1) {
      const t = interpolate(fr, [k0, k1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut});
      const p: CamPos = {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t};
      if (angled(a) || angled(b)) {
        const l = (u: number | undefined, v: number | undefined, d: number) => (u ?? d) + ((v ?? d) - (u ?? d)) * t;
        p.h = l(a.h, b.h, CAM.height);
        p.tilt = l(a.tilt, b.tilt, CAM.tilt);
        p.yaw = l(a.yaw, b.yaw, 0);
      }
      return p;
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
  const h = p.h ?? CAM.height;
  const tilt = THREE.MathUtils.degToRad(p.tilt ?? CAM.tilt);
  const yaw = p.yaw ?? 0;
  if (!yaw) {
    c.position.set(p.x, h, p.z);
    c.rotation.set(tilt, 0, 0, 'XYZ');
  } else {
    // orbit: the ground position turns about the hero point and the camera turns with it
    const dx = p.x - FOCUS.x, dz = p.z - FOCUS.z, cy = Math.cos(yaw), sy = Math.sin(yaw);
    c.position.set(FOCUS.x + dx * cy + dz * sy, h, FOCUS.z - dx * sy + dz * cy);
    c.rotation.set(tilt, yaw, 0, 'YXZ');
  }
  c.updateMatrixWorld();
};

// Named shots the writer and the form choose from, per act. `standard` is the approved default.
export const SHOTS = {
  standard: {},
  wide: {h: 4.2, tilt: -11},
  aerial: {h: 7.5, tilt: -25},
  low: {h: 2.1, tilt: -4},
  'orbit-left': {yaw: 0.38},
  'orbit-right': {yaw: -0.38},
} as const;
