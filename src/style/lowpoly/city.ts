// Seeded procedural set, built in local coordinates centred on the bridge: two raised blocks
// either side of a channel (local z runs away from camera), open water in front of them, a
// suspension bridge across the channel mouth, instanced buildings fading into fog. The whole set is
// yawed so the bridge reads three-quarter instead of a one-point corridor.
// Model scale: the set is a miniature (rooftops sit below the 3.4 m camera) so the long lens reads
// it as a model rather than a street.
import * as THREE from 'three';
import {random} from 'remotion';
import {PALETTE, col} from './palette';
import {BRIDGE, TREE_VARIANTS, carGeometry, chamferBox, flat, instanced, makeBridge, mat4, treeGeometry} from './props';

export const SET = {
  landY: 0.45, // top of the raised blocks above the water line
  channel: 0.95, // half-width of the channel
  front: 3.0, // local z of the blocks' front embankment
  yaw: Math.PI + 0.45, // camera looks over the city, past the bridge, out to open water
  hero: new THREE.Vector3(0, 0, -6), // world position of the bridge centre
};

// The lot the server farm stands on when a film uses it (local coords, centre and half-size).
export const SERVER_LOT = {x: -2.6, z: 1.85, hx: 0.85, hz: 0.5};

// World-space circles kept free of trees and buildings (e.g. where the hero figure sits).
export type Clear = {x: number; z: number; r: number};
export type CityOpts = {seed: string | number; accent: string; server?: boolean; clear?: Clear[]};

export type Building = {x: number; z: number; w: number; h: number; d: number; far: boolean};
export type Rect = {x0: number; x1: number; z0: number; z1: number; y?: number};

export type City = {
  group: THREE.Group; // add to the scene
  local: THREE.Group; // the yawed set frame; effects add children here in local coords
  water: THREE.Mesh;
  bridge: THREE.Mesh;
  buildings: THREE.InstancedMesh;
  records: Building[]; // one per instance, same order
  park: Rect;
  walk: Rect[]; // open surfaces people can stand on (local)
  toWorld: (x: number, z: number) => THREE.Vector3;
};

type Item = {m: THREE.Matrix4; c: string};

const slab = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, color: string) => {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)).toNonIndexed();
  const m = new THREE.Mesh(g, flat(col(color)));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
};

export const buildCity = ({seed, accent, server = false, clear = []}: CityOpts): City => {
  const r = (k: string) => random(`${seed}:${k}`);
  const root = new THREE.Group();
  const group = new THREE.Group();
  group.position.copy(SET.hero);
  group.rotation.y = SET.yaw;
  root.add(group);
  const {landY, channel: C, front: Zf} = SET;
  const FAR = -260, WIDE = 40, t = 0.02;
  const Q = 0.2, ROAD = 0.4, xq = C + Q + ROAD; // quay sidewalk + road along the channel

  const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), flat(col(PALETTE.water)));
  water.receiveShadow = true;
  root.add(water);

  for (const s of [-1, 1]) {
    const a = s * C, e = s * WIDE;
    group.add(slab(a, e, FAR, Zf, -1, landY - t, PALETTE.sidewalk)); // embankment
    group.add(slab(s * (C + Q), s * xq, FAR, Zf - Q, landY - t, landY, PALETTE.asphalt)); // quay road
    group.add(slab(s * xq, e, -0.21, 0.21, landY - t, landY, PALETTE.asphalt)); // street off the bridge
  }

  // waterfront park on the near bank, under the camera path: keeps big buildings out of the
  // foreground so the lower frame reads as small things seen from above
  const P = {x0: xq + Q, x1: 4.6, z0: -6.2, z1: -0.6};
  const inPark = (x: number, z: number, pad = 0) => x > P.x0 - pad && x < P.x1 + pad && z > P.z0 - pad && z < P.z1 + pad;
  group.add(slab(P.x0 + 0.15, P.x1 - 0.15, P.z0 + 0.15, P.z1 - 0.15, landY - t, landY, PALETTE.grass));

  const bridge = makeBridge(accent);
  group.add(bridge.group);

  // buildings behind the bridge street, low near the water and the camera
  const items: Item[] = [];
  const records: Building[] = [];
  const cell = 1.3;
  // building colours, weighted: the deep brick tone is rare so it never competes with the accent
  const W = [0.24, 0.25, 0.2, 0.25, 0.06];
  const bcol = (k: string) => {
    let u = r(`c${k}`), i = 0;
    while (i < W.length - 1 && u > W[i]) u -= W[i++];
    return PALETTE.buildings[i];
  };
  // distance from the opening camera position: near buildings stay low so we see their roofs
  group.updateMatrixWorld(true);
  const toWorld = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(group.matrixWorld);
  const blocked = (x: number, z: number, pad: number) => {
    const w = toWorld(x, z);
    return clear.some((c) => Math.hypot(w.x - c.x, w.z - c.z) < c.r + pad);
  };
  const L = SERVER_LOT;
  const onLot = (x: number, z: number, pad: number) => server && Math.abs(x - L.x) < L.hx + pad && Math.abs(z - L.z) < L.hz + pad;
  const camXZ = new THREE.Vector2(0, 12);
  const camDist = (x: number, z: number) => {
    const w = new THREE.Vector3(x, 0, z).applyMatrix4(group.matrixWorld);
    return camXZ.distanceTo(new THREE.Vector2(w.x, w.z));
  };
  for (let row = 0; row < 190; row++) {
    const z = Zf - 0.8 - row * cell;
    if (z < FAR + 20) break;
    if (row % 5 === 2 || Math.abs(z) < 0.75) continue; // cross streets, bridge street
    for (let ci = 0; ci < 16; ci++) {
      for (const s of [-1, 1]) {
        const k = `${row}:${ci}:${s}`;
        if (r(`gap${k}`) < 0.14) continue;
        const w = 0.7 + r(`w${k}`) * 0.4, d = 0.7 + r(`d${k}`) * 0.4;
        const x = s * (xq + 0.25 + ci * cell + w / 2);
        if (inPark(x, z, 0.6) || onLot(x, z, 0.45) || blocked(x, z, 0.6)) continue;
        // low near the camera (we see roofs) and around the bridge (its silhouette stays on water)
        const near = THREE.MathUtils.clamp((camDist(x, z) - 6) / 16, 0.3, 1) * THREE.MathUtils.clamp(Math.hypot(x, z) / 5, 0.45, 1);
        const h = (0.4 + r(`h${k}`) * 0.85 + (r(`t${k}`) < 0.06 ? 0.7 : 0)) * near;
        items.push({m: mat4(x, landY, z, w, h, d), c: bcol(k)});
        records.push({x, z, w, h, d, far: false});
      }
    }
  }
  // far shore across the bay: a low skyline band fading into the fog
  const SH = {z0: 85, z1: 175};
  group.add(slab(-90, 90, SH.z0, SH.z1 + 40, -1, landY, PALETTE.sidewalk));
  for (let row = 0; row * cell < SH.z1 - SH.z0; row++) {
    const z = SH.z0 + 0.8 + row * cell;
    for (let ci = -60; ci < 60; ci++) {
      const k = `far${row}:${ci}`;
      if (r(`gap${k}`) < 0.2 || row % 5 === 3) continue;
      const w = 0.7 + r(`w${k}`) * 0.4, d = 0.7 + r(`d${k}`) * 0.4;
      const h = 0.5 + r(`h${k}`) * 1.1 + (r(`t${k}`) < 0.07 ? 1.0 + r(`tt${k}`) * 1.2 : 0);
      items.push({m: mat4(ci * cell, landY, z, w, h, d), c: bcol(k)});
      records.push({x: ci * cell, z, w, h, d, far: true});
    }
  }
  const buildings = instanced(chamferBox(1, 1, 1, 0.03), items);
  group.add(buildings);

  // trees: a few on each front lawn, sparse along the quays
  const {canopy, trunk} = treeGeometry();
  const can: Item[] = [], trk: Item[] = [];
  const tree = (x: number, z: number, k: string) => {
    if (blocked(x, z, 0.25) || onLot(x, z, 0.2)) return;
    const v = TREE_VARIANTS[Math.floor(r(`tv${k}`) * 3)];
    const s = 0.55 + r(`ts${k}`) * 0.15;
    trk.push({m: mat4(x, landY, z, 1, v.trunk * s, 1), c: PALETTE.trunk});
    can.push({m: mat4(x, landY + v.trunk * s + v.r * v.sy * s * 0.7, z, v.r * s, v.r * v.sy * s, v.r * s, r(`tr${k}`) * 6.28), c: r(`tc${k}`) < 0.5 ? PALETTE.canopyA : PALETTE.canopyB});
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      tree(s * (xq + 0.6 + i * 0.75 + r(`lx${s}${i}`) * 0.3), 0.9 + r(`lz${s}${i}`) * 1.4, `l${s}${i}`);
    }
    for (let i = 0; i < 6; i++) tree(s * (xq + 0.1), -1.6 - i * 3.9, `q${s}${i}`);
  }
  for (let i = 0; i < 6; i++) tree(P.x0 + 0.6 + r(`px${i}`) * (P.x1 - P.x0 - 1.2), P.z1 - 0.6 - r(`pz${i}`) * (P.z1 - P.z0 - 1.2), `p${i}`);
  group.add(instanced(canopy, can), instanced(trunk, trk));

  // cars: a handful on the quay roads and the bridge street
  const cars: Item[] = [];
  const carC = (k: string) => PALETTE.cars[Math.floor(r(`cc${k}`) * PALETTE.cars.length)];
  for (const s of [-1, 1]) {
    cars.push({m: mat4(s * (xq + 0.9 + r(`bx${s}`) * 1.5), landY, s * 0.09), c: carC(`b${s}`)});
    for (let i = 0; i < 3; i++) {
      const z = -1.2 - i * 4.1 - r(`cz${s}${i}`) * 1.5;
      cars.push({m: mat4(s * (C + Q + ROAD / 2 + 0.09), landY, z, 1, 1, 1, Math.PI / 2), c: carC(`q${s}${i}`)});
    }
  }
  group.add(instanced(carGeometry(), cars));

  const walk: Rect[] = [
    P,
    {x0: C + Q, x1: xq, z0: -16, z1: Zf - Q}, // near quay road
    {x0: -xq, x1: -C - Q, z0: -16, z1: Zf - Q}, // far quay road
    {x0: xq, x1: 9, z0: -0.2, z1: 0.2}, // street off the bridge (near)
    {x0: -9, x1: -xq, z0: -0.2, z1: 0.2}, // street off the bridge (far)
    {x0: -BRIDGE.half, x1: BRIDGE.half, z0: -0.1, z1: 0.1, y: BRIDGE.deckY}, // bridge deck
    {x0: C, x1: 9, z0: Zf - 0.18, z1: Zf - 0.04}, // front promenades
    {x0: -9, x1: -C, z0: Zf - 0.18, z1: Zf - 0.04},
  ];
  return {group: root, local: group, water, bridge: bridge.mesh, buildings, records, park: P, walk, toWorld};
};
