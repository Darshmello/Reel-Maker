// Megacity: a dense future downtown of window-banded towers around a small plaza, an accent spire
// on the skyline and a pale monorail crossing the block. Frame (yaw 0, camera at world z=12, 24 deg
// lens): local z = world z + 6; the visible ground starts near local z 10.7 and is only ~2.4 m wide
// there, so the bottom of the shot is the plaza paving, a bench, trees and the crossing.
import {THREE, blocks, box, carGeometry, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.35;
const STREET: Rect = {x0: 0.55, x1: 1.25, z0: -44, z1: 12};
const WALK_L: Rect = {x0: 0.33, x1: 0.55, z0: -44, z1: 12};
const WALK_R: Rect = {x0: 1.25, x1: 1.47, z0: -44, z1: 12};
const CROSS: Rect = {x0: -20, x1: 18, z0: -10.4, z1: -9.6};
const PLAZA: Rect = {x0: -2.4, x1: 0.33, z0: 2.8, z1: 9.8};
const PARK: Rect = {x0: -5.4, x1: -2.6, z0: 3.4, z1: 9.4};
const LOT = {x: -2.5, z: -0.6, hx: 0.7, hz: 0.45};
const FOUNTAIN = {x: -0.7, z: 6.3};
const SPIRE = {x: 1.9, z: -4.6};
const RAIL_Z = -11.2;
const RAIL_Y = 1.2;
const FAR: Rect = {x0: -56, x1: 56, z0: -118, z1: -76};
const HILLS: [number, number][] = [[-44, -66], [-10, -88], [26, -74], [54, -98], [-72, -104]];

export const pack: SetPack = {
  hero: {x: -1.3, z: -0.8, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);
    const mesh = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(g, flat(col(color)));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const inRect = (R: Rect, x: number, z: number, m = 0) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
    const onStreet = (x: number, z: number, pad = 0) => inRect(STREET, x, z, pad) || inRect(CROSS, x, z, pad) || inRect(WALK_L, x, z, pad) || inRect(WALK_R, x, z, pad);
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.5 && Math.abs(z - LOT.z) < LOT.hz + 0.5;
    const free = (x: number, z: number) => !onStreet(x, z, 0.05) && !inRect(PLAZA, x, z, 0.15) && !inRect(PARK, x, z, 0.15) && !onLot(x, z) && ok(x, z, 0.4);

    const water = sea(P.water);
    group.add(water);
    local.add(slab(-95, 95, -320, 40, -1, LAND, P.ground));

    // ---- ground: street, sidewalks, cross street, plaza paving, park lawn
    local.add(slab(STREET.x0, STREET.x1, STREET.z0, STREET.z1, LAND, LAND + 0.008, P.street));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z0, CROSS.z1, LAND, LAND + 0.008, P.street));
    local.add(slab(WALK_L.x0, WALK_L.x1, WALK_L.z0, WALK_L.z1, LAND, LAND + 0.014, P.plaza));
    local.add(slab(WALK_R.x0, WALK_R.x1, WALK_R.z0, WALK_R.z1, LAND, LAND + 0.014, P.plaza));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z0 - 0.16, CROSS.z0, LAND, LAND + 0.014, P.plaza));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z1, CROSS.z1 + 0.16, LAND, LAND + 0.014, P.plaza));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.plaza));
    local.add(slab(PARK.x0, PARK.x1, PARK.z0, PARK.z1, LAND, LAND + 0.012, P.park));
    // zebra crossing at the junction and lane dashes down the street
    const stripes: Item[] = [];
    for (let i = 0; i < 7; i++) stripes.push({m: mat4(STREET.x0 + 0.05 + i * 0.09, LAND + 0.012, -8.6, 0.055, 0.006, 0.9), c: P.crosswalk});
    for (let i = 0; i < 7; i++) stripes.push({m: mat4(STREET.x0 + 0.05 + i * 0.09, LAND + 0.012, 7.9, 0.055, 0.006, 0.8), c: P.crosswalk});
    for (let z = -42; z < 11; z += 1.7) stripes.push({m: mat4((STREET.x0 + STREET.x1) / 2, LAND + 0.012, z, 0.03, 0.006, 0.3), c: P.crosswalk});
    local.add(instanced(box(1, 1, 1), stripes, false));

    // ---- plaza: paving joints, a low fountain with a jet and a small accent globe, benches, lamps
    for (let x = PLAZA.x0 + 0.45; x < PLAZA.x1; x += 0.45) local.add(slab(x - 0.008, x + 0.008, PLAZA.z0, PLAZA.z1, LAND + 0.012, LAND + 0.015, P.plazaLine));
    for (let z = PLAZA.z0 + 0.45; z < PLAZA.z1; z += 0.45) local.add(slab(PLAZA.x0, PLAZA.x1, z - 0.008, z + 0.008, LAND + 0.012, LAND + 0.015, P.plazaLine));
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.12, 12).toNonIndexed(), flat(col(P.plazaLine)));
    basin.position.set(FOUNTAIN.x, LAND + 0.06, FOUNTAIN.z);
    basin.castShadow = true;
    basin.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.026, 4, 12).toNonIndexed(), flat(col(P.crosswalk)));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(FOUNTAIN.x, LAND + 0.12, FOUNTAIN.z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.14, 10).toNonIndexed(), flat(col(P.crosswalk)));
    bowl.position.set(FOUNTAIN.x, LAND + 0.19, FOUNTAIN.z);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.3, 8).toNonIndexed(), flat(col(P.water)));
    jet.position.set(FOUNTAIN.x, LAND + 0.4, FOUNTAIN.z);
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0).toNonIndexed(), flat(col(accent)));
    globe.position.set(FOUNTAIN.x, LAND + 0.6, FOUNTAIN.z);
    local.add(basin, rim, bowl, jet, globe);
    const benches: Item[] = [];
    for (const [bx, bz, ry] of [[-1.15, 5.0, 0], [-1.2, 7.4, 0], [0.1, 8.6, 0.25]]) {
      benches.push({m: mat4(bx, LAND + 0.06, bz, 0.44, 0.05, 0.13, ry), c: P.plazaLine});
      benches.push({m: mat4(bx, LAND + 0.1, bz - 0.1, 0.44, 0.16, 0.03, ry), c: P.plazaLine});
    }
    local.add(instanced(chamferBox(1, 1, 1, 0.01), benches));
    for (const [lx, lz] of [[-0.2, 3.0], [0.15, 9.2], [-2.3, 9.0]]) {
      local.add(mesh(box(0.035, 0.95, 0.035), P.crosswalk, lx, LAND, lz));
      local.add(mesh(box(0.07, 0.05, 0.07), P.winLit, lx, LAND + 0.95, lz));
    }
    const trees = forest(seed, 'plazaTree', [PARK, {x0: -2.3, x1: -2.0, z0: 3.4, z1: 4.4}, {x0: -2.4, x1: -2.1, z0: 8.6, z1: 9.4}], 12, LAND, {canopy: P.tree, trunk: P.trunk}, (x, z) => !inRect(PLAZA, x, z, -0.1) && Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) > 0.7, 1.05);
    local.add(trees);
    local.add(forest(seed, 'nearTree', [{x0: 0.02, x1: 0.06, z0: 4.1, z1: 4.14}], 1, LAND, {canopy: P.tree, trunk: P.trunk}, () => true, 0.95));
    local.add(forest(seed, 'nearTree2', [{x0: -1.34, x1: -1.3, z0: 9.0, z1: 9.04}], 1, LAND, {canopy: P.tree, trunk: P.trunk}, () => true, 1.15));

    // ---- towers: two blocks of window-banded high-rises, plus a low far layer
    const rowR = blocks(seed, 'rowR', {x0: 1.6, x1: 10.5, z0: -8.6, z1: 0.2}, LAND, P.building, {cell: 1.25, gap: 0.16, hMin: 0.85, hMax: 2.05, ok: free});
    const rowL = blocks(seed, 'rowL', {x0: -10.5, x1: -2.6, z0: -8.6, z1: 0.2}, LAND, P.building, {cell: 1.25, gap: 0.16, hMin: 0.8, hMax: 1.9, ok: free});
    const rowR2 = blocks(seed, 'rowR2', {x0: 1.6, x1: 10.5, z0: -22.0, z1: -11.6}, LAND, P.building, {cell: 1.5, gap: 0.24, hMin: 0.7, hMax: 1.7, ok: free, heightAt: () => 0.95});
    const rowL2 = blocks(seed, 'rowL2', {x0: -10.5, x1: -2.6, z0: -22.0, z1: -11.6}, LAND, P.building, {cell: 1.5, gap: 0.24, hMin: 0.7, hMax: 1.7, ok: free, heightAt: () => 0.95});
    const rows = [rowR, rowL, rowR2, rowL2];
    const records = rows.flatMap((r) => r.records);
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), rows.flatMap((r) => r.items));
    local.add(buildings);
    // set-back roofs and 2-3 window bands per tower: the thing that makes a box read as a building
    const roofs: Item[] = [];
    const bands: Item[] = [];
    const store: Item[] = [];
    const lights: Item[] = [];
    const awnings: Item[] = [];
    records.forEach((b, i) => {
      roofs.push({m: mat4(b.x, LAND + b.h, b.z, b.w * 0.86, 0.05, b.d * 0.86), c: P.roof});
      store.push({m: mat4(b.x, LAND + 0.16, b.z + b.d / 2 + 0.014, b.w * 0.9, 0.24, 0.02), c: P.storeFront});
      store.push({m: mat4(b.x + b.w / 2 + 0.014, LAND + 0.16, b.z, 0.02, 0.24, b.d * 0.9), c: P.storeFront});
      const n = b.h > 1.3 ? 3 : 2;
      for (let k = 1; k <= n; k++) {
        const y = LAND + (b.h * k) / (n + 1);
        const bw = b.w * 0.78, bd = b.d * 0.78;
        bands.push({m: mat4(b.x, y, b.z + b.d / 2 + 0.012, bw, 0.09, 0.02), c: P.winBand});
        bands.push({m: mat4(b.x, y, b.z - b.d / 2 - 0.012, bw, 0.09, 0.02), c: P.winBand});
        bands.push({m: mat4(b.x + b.w / 2 + 0.012, y, b.z, 0.02, 0.09, bd), c: P.winBand});
        bands.push({m: mat4(b.x - b.w / 2 - 0.012, y, b.z, 0.02, 0.09, bd), c: P.winBand});
        if (rand(seed, `lit${i}:${k}`) > 0.72) lights.push({m: mat4(b.x - b.w * 0.18, y, b.z + b.d / 2 + 0.016, 0.12, 0.07, 0.02), c: P.winLit});
      }
      if (b.z > -2.5 && i % 3 === 0) awnings.push({m: mat4(b.x, LAND + 0.34, b.z + b.d / 2 + 0.09, b.w * 0.86, 0.05, 0.14), c: pick(seed, `aw${i}`, P.car)});
    });
    local.add(instanced(chamferBox(1, 1, 1, 0.01), roofs));
    local.add(instanced(box(1, 1, 1), bands, false));
    local.add(instanced(box(1, 1, 1), store, false));
    if (awnings.length) local.add(instanced(box(1, 1, 1), awnings));
    if (lights.length) local.add(instanced(box(1, 1, 1), lights, false));

    // ---- the accent landmark: a spire tower just right of centre, visible over the block
    local.add(mesh(chamferBox(0.5, 2.5, 0.5, 0.02), accent, SPIRE.x, LAND, SPIRE.z));
    local.add(mesh(box(0.56, 0.1, 0.56), P.crosswalk, SPIRE.x, LAND + 2.5, SPIRE.z));
    local.add(mesh(new THREE.ConeGeometry(0.1, 0.9, 4).toNonIndexed(), accent, SPIRE.x, LAND + 2.6 + 0.45, SPIRE.z));
    local.add(mesh(box(0.02, 0.5, 0.02), accent, SPIRE.x, LAND + 3.5, SPIRE.z));
    for (const y of [0.9, 1.6, 2.2]) local.add(mesh(box(0.54, 0.06, 0.54), P.winLit, SPIRE.x, LAND + y, SPIRE.z));

    // ---- the monorail: a pale deck on pylons crossing the block, with a train on top
    const rail = new THREE.Group();
    rail.add(mesh(box(22, 0.12, 0.5), P.monorail, 0, LAND + RAIL_Y, RAIL_Z));
    rail.add(mesh(box(22, 0.05, 0.07), accent, 0, LAND + RAIL_Y + 0.1, RAIL_Z - 0.16));
    rail.add(mesh(box(22, 0.05, 0.07), accent, 0, LAND + RAIL_Y + 0.1, RAIL_Z + 0.16));
    for (let x = -10; x <= 10; x += 2.5) {
      rail.add(mesh(box(0.14, RAIL_Y, 0.14), P.roof, x, LAND, RAIL_Z));
      rail.add(mesh(box(0.5, 0.06, 0.5), P.roof, x, LAND + RAIL_Y - 0.06, RAIL_Z));
    }
    for (const [cx, len] of [[-3.4, 1.5], [-1.7, 1.5], [0.0, 1.5]]) {
      rail.add(mesh(chamferBox(len, 0.3, 0.42, 0.03), P.train, cx, LAND + RAIL_Y + 0.12, RAIL_Z));
      rail.add(mesh(box(len * 0.82, 0.12, 0.44), P.winBand, cx, LAND + RAIL_Y + 0.22, RAIL_Z));
    }
    local.add(rail);

    // ---- street furniture: kiosk, planters, parked cars
    local.add(mesh(chamferBox(0.55, 0.42, 0.45, 0.02), P.building[1], -2.0, LAND, 7.8));
    local.add(slab(-2.3, -1.7, 7.55, 8.05, LAND + 0.42, LAND + 0.46, P.winLit));
    const planters: Item[] = [];
    const planterGreen: Item[] = [];
    for (const [px, pz] of [[0.1, 4.2], [0.15, 6.6], [-1.0, 9.2]]) {
      planters.push({m: mat4(px, LAND + 0.02, pz, 0.26, 0.16, 0.26), c: P.plazaLine});
      planterGreen.push({m: mat4(px, LAND + 0.13, pz, 0.15, 0.12, 0.15, 0.4), c: P.tree[0]});
    }
    local.add(instanced(chamferBox(1, 1, 1, 0.01), planters));
    local.add(instanced(new THREE.IcosahedronGeometry(1, 0), planterGreen));
    const cars: Item[] = [];
    for (const [cx, cz] of [[0.9, 2.4], [0.9, -3.2], [0.9, -14.0], [0.9, -24.0]]) cars.push({m: mat4(cx, LAND + 0.012, cz, 1, 1, 1, 0), c: pick(seed, `car${cz}`, P.car)});
    local.add(instanced(carGeometry(), cars));

    // ---- far skyline and hills
    const far = blocks(seed, 'far', FAR, LAND, P.building, {cell: 3.4, gap: 0.4, hMin: 1.2, hMax: 3.0, far: true});
    local.add(instanced(chamferBox(1, 1, 1, 0.02), far.items));
    for (let i = 0; i < HILLS.length; i++) {
      const g = hill(seed, `hill${i}`, 14 + rand(seed, `hr${i}`) * 8, 2.4 + rand(seed, `hh${i}`) * 2.2, 6);
      local.add(mesh(g, i % 2 ? P.hillFar : P.hill, HILLS[i][0], LAND - 0.2, HILLS[i][1]));
    }

    // rocket pads in the empty block behind the second row
    const pads = {
      x0: -4.0,
      x1: 4.0,
      z: -28,
      ok: (w: THREE.Vector3) => {
        const x = w.x, z = w.z + 6;
        if (z > -24 || z < -33) return false;
        if (Math.abs(x) < 0.9) return false;
        if (onLot(x, z)) return false;
        if (Math.abs(x - SPIRE.x) < 1 && Math.abs(z - SPIRE.z) < 1) return false;
        if (records.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35)) return false;
        return true;
      },
    };

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records,
      walk: [PLAZA, PARK, STREET, WALK_L, WALK_R, CROSS],
      snow: [{x0: -95, x1: 95, z0: -320, z1: 40}],
      lot: LOT,
      pads,
    };
  },
};
