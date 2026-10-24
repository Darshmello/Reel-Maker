// Building blocks for set packs: the house style's primitives, so every pack looks like it belongs
// to the same world. Packs import from here and from their own palette.ts, nothing else of ours.
import * as THREE from 'three';
import {random} from 'remotion';
import {col} from '../style/lowpoly/palette';
import {box, carGeometry, chamferBox, flat, instanced, makeBridge, mat4, treeGeometry, TREE_VARIANTS} from '../style/lowpoly/props';

export {THREE, box, carGeometry, chamferBox, col, flat, instanced, makeBridge, mat4, treeGeometry, TREE_VARIANTS};
export type {Building, Clear, Lot, Rect, SetBuild, SetOpts, SetPack} from './types';

// Seeded random in [0, 1): the only randomness a pack may use.
export const rand = (seed: string, key: string) => random(`${seed}:${key}`);

// Pick from a weighted list with a seeded draw.
export const pick = <T>(seed: string, key: string, items: readonly T[], weights?: readonly number[]) => {
  const w = weights ?? items.map(() => 1);
  let u = rand(seed, key) * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < items.length - 1 && u > w[i]) u -= w[i++];
  return items[i];
};

// An axis-aligned slab from (x0, y0, z0) to (x1, y1, z1), shadow-receiving.
export const slab = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, color: string) => {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)).toNonIndexed();
  const m = new THREE.Mesh(g, flat(col(color)));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
};

// A flat sea at y=0 in world space, wide enough to reach the fog.
export const sea = (color: string) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), flat(col(color)));
  m.receiveShadow = true;
  return m;
};

// A low-poly hill or mountain: a cone with few sides, jittered so it never looks machined.
export const hill = (seed: string, key: string, radius: number, height: number, sides = 7) => {
  const g = new THREE.ConeGeometry(radius, height, sides, 2).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > -height / 2 + 1e-3 && y < height / 2 - 1e-3) {
      const k = `${key}:${Math.round(p.getX(i) * 100)}:${Math.round(p.getZ(i) * 100)}:${Math.round(y * 100)}`;
      p.setXYZ(i, p.getX(i) * (0.85 + rand(seed, `hx${k}`) * 0.3), y + (rand(seed, `hy${k}`) - 0.5) * height * 0.12, p.getZ(i) * (0.85 + rand(seed, `hz${k}`) * 0.3));
    }
  }
  g.translate(0, height / 2, 0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
};

// The standard frame: a root group in world space and a local group placed at the hero point,
// yawed so the stage reads three-quarter to the camera. Returns toWorld for that frame.
export const frame = (yaw = 0, at = new THREE.Vector3(0, 0, -6)) => {
  const group = new THREE.Group();
  const local = new THREE.Group();
  local.position.copy(at);
  local.rotation.y = yaw;
  group.add(local);
  local.updateMatrixWorld(true);
  const toWorld = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(local.matrixWorld);
  return {group, local, toWorld};
};

// Is a local point inside a world-space clear circle (with padding)?
export const isClear = (toWorld: (x: number, z: number) => THREE.Vector3, clear: {x: number; z: number; r: number}[]) => (x: number, z: number, pad = 0) => {
  const w = toWorld(x, z);
  return !clear.some((c) => Math.hypot(w.x - c.x, w.z - c.z) < c.r + pad);
};

// Scatter low-poly trees over local rects, skipping anything `ok` rejects.
export const forest = (seed: string, key: string, rects: {x0: number; x1: number; z0: number; z1: number}[], n: number, y: number, colors: {canopy: readonly string[]; trunk: string}, ok: (x: number, z: number) => boolean = () => true, size = 1) => {
  const {canopy, trunk} = treeGeometry();
  const can: {m: THREE.Matrix4; c: string}[] = [], trk: {m: THREE.Matrix4; c: string}[] = [];
  for (let i = 0; i < n; i++) {
    const R = rects[i % rects.length];
    const x = THREE.MathUtils.lerp(R.x0, R.x1, rand(seed, `${key}x${i}`));
    const z = THREE.MathUtils.lerp(R.z0, R.z1, rand(seed, `${key}z${i}`));
    if (!ok(x, z)) continue;
    const v = TREE_VARIANTS[Math.floor(rand(seed, `${key}v${i}`) * 3)];
    const s = (0.55 + rand(seed, `${key}s${i}`) * 0.15) * size;
    trk.push({m: mat4(x, y, z, 1, v.trunk * s, 1), c: colors.trunk});
    can.push({m: mat4(x, y + v.trunk * s + v.r * v.sy * s * 0.7, z, v.r * s, v.r * v.sy * s, v.r * s, rand(seed, `${key}r${i}`) * 6.28), c: pick(seed, `${key}c${i}`, colors.canopy)});
  }
  const g = new THREE.Group();
  if (can.length) g.add(instanced(canopy, can), instanced(trunk, trk));
  return g;
};

// Rows of buildings over a local rect. Returns the instanced mesh and its records (for towers/snow/crowd).
export const blocks = (seed: string, key: string, R: {x0: number; x1: number; z0: number; z1: number}, y: number, colors: readonly string[], opts: {cell?: number; gap?: number; hMin?: number; hMax?: number; far?: boolean; ok?: (x: number, z: number) => boolean; heightAt?: (x: number, z: number) => number} = {}) => {
  const {cell = 1.3, gap = 0.15, hMin = 0.4, hMax = 1.25, far = false, ok = () => true, heightAt = () => 1} = opts;
  const items: {m: THREE.Matrix4; c: string}[] = [];
  const records: {x: number; z: number; w: number; h: number; d: number; far: boolean}[] = [];
  for (let x = R.x0 + cell / 2; x < R.x1; x += cell) {
    for (let z = R.z0 + cell / 2; z < R.z1; z += cell) {
      const k = `${key}${Math.round(x * 10)}:${Math.round(z * 10)}`;
      if (rand(seed, `g${k}`) < gap || !ok(x, z)) continue;
      const w = 0.7 + rand(seed, `w${k}`) * 0.4, d = 0.7 + rand(seed, `d${k}`) * 0.4;
      const h = (hMin + rand(seed, `h${k}`) * (hMax - hMin)) * heightAt(x, z);
      items.push({m: mat4(x, y, z, w, h, d), c: pick(seed, `c${k}`, colors)});
      records.push({x, z, w, h, d, far});
    }
  }
  return {items, records};
};
