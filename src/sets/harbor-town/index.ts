// Harbor Town: colourful houses stacked up a hill behind a fishing quay, small boats in the basin,
// a striped lighthouse in the accent colour at the end of a breakwater, and open sea behind.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets the ground near local z 10.7,
// the centre near local z 1; the frame is only ~3 m wide at the plaza and ~2 m wide on the water.
import {THREE, blocks, box, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const WATER_Y = LAND - 0.1;
const PLAZA: Rect = {x0: -1.8, x1: 0.2, z0: 3.8, z1: 6.3};
const QUAY: Rect = {x0: -90, x1: 90, z0: 6.3, z1: 7.2};
const LOT = {x: 1.0, z: 0.6, hx: 0.7, hz: 0.45};
const LOT_R: Rect = {x0: LOT.x - LOT.hx, x1: LOT.x + LOT.hx, z0: LOT.z - LOT.hz, z1: LOT.z + LOT.hz};
const FIELD: Rect = {x0: -0.4, x1: 4.6, z0: -24, z1: -8};
const PIERS: Rect[] = [{x0: 0.98, x1: 1.18, z0: 7.2, z1: 9.8}, {x0: -1.45, x1: -1.25, z0: 7.2, z1: 9.2}];
const ROADS: Rect[] = [
  {x0: -14, x1: 14, z0: 2.05, z1: 2.35},
  {x0: -0.9, x1: -0.6, z0: -30, z1: 3.8},
  {x0: -3.7, x1: -3.4, z0: -48, z1: 2.05},
  {x0: -12, x1: -0.6, z0: -9.15, z1: -8.85},
  {x0: -12, x1: -0.6, z0: -19.15, z1: -18.85},
  {x0: -12, x1: -0.6, z0: -29.15, z1: -28.85},
];
const LH = {x: 2.7, z: -57.5};

const inside = (x: number, z: number, r: Rect, p: number) => x > r.x0 - p && x < r.x1 + p && z > r.z0 - p && z < r.z1 + p;

export const pack: SetPack = {
  hero: {x: -1.0, z: -1.0, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);
    const unit = chamferBox(1, 1, 1, 0.02);
    const ub = box(1, 1, 1);

    // the sea sits just under the harbour water: water acts flood the town from below
    const water = sea(P.sea);
    group.add(water);

    // ground: harbour water, shallows by the quay, grass land with a hillside to the left
    local.add(slab(-90, 90, -280, 70, -1, WATER_Y, P.water));
    local.add(slab(-90, 90, 7.2, 8.3, -1, WATER_Y + 0.004, P.shallow));
    local.add(slab(-90, 90, -30, 7.2, -1, LAND, P.grass));
    local.add(slab(-90, -2, -50, -30, -1, LAND, P.grass));
    for (const r of ROADS) local.add(slab(r.x0, r.x1, r.z0, r.z1, LAND, LAND + 0.008, P.road));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.plaza));
    local.add(slab(QUAY.x0, QUAY.x1, QUAY.z0, QUAY.z1, LAND, LAND + 0.03, P.quay));
    local.add(slab(LOT_R.x0, LOT_R.x1, LOT_R.z0, LOT_R.z1, LAND, LAND + 0.01, P.plaza));

    // allotment strips on the hillside: open ground where rockets can stand
    for (let i = 0; i < 10; i++) local.add(slab(FIELD.x0 + i * 0.5, FIELD.x0 + i * 0.5 + 0.46, FIELD.z0, FIELD.z1, LAND, LAND + 0.01, P.crops[i % 3]));

    // the town: low houses on the quay, taller and taller up the hill, thinning to the right
    const houseOk = (x: number, z: number) => {
      if (!ok(x, z, 0.5) || z > 6.0) return false;
      if (ROADS.some((r) => inside(x, z, r, 0.6)) || inside(x, z, PLAZA, 0.55) || inside(x, z, LOT_R, 0.55) || inside(x, z, FIELD, 0.55)) return false;
      if (z < -29 && x > -2.5) return false;
      const u = rand(seed, `dens${Math.round(x * 10)}:${Math.round(z * 10)}`);
      if (x > 2 && z < -18) return u > 0.7;
      if (x > 2 && z < -6) return u > 0.4;
      return true;
    };
    const town = blocks(seed, 'town', {x0: -11, x1: 11, z0: -46.2, z1: 6.6}, LAND, P.house, {
      cell: 1.1,
      gap: 0.1,
      hMin: 0.3,
      hMax: 0.8,
      ok: houseOk,
      heightAt: (_x, z) => THREE.MathUtils.clamp(0.8 + (3 - z) * 0.05, 0.8, 2.4),
    });
    const records = town.records;
    const buildings = instanced(unit, town.items);
    local.add(buildings);

    // pitched roofs on most houses
    const roofG = new THREE.ConeGeometry(0.7071, 1, 4, 1).toNonIndexed();
    roofG.rotateY(Math.PI / 4);
    roofG.deleteAttribute('uv');
    roofG.translate(0, 0.5, 0);
    const roofs: Item[] = [];
    records.forEach((b, i) => {
      if (rand(seed, `rf${i}`) < 0.3) return;
      roofs.push({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.05, 0.12 + rand(seed, `rh${i}`) * 0.14, b.d * 1.05), c: pick(seed, `rc${i}`, P.roof)});
    });
    if (roofs.length) local.add(instanced(roofG, roofs));

    // everything scattered so far, to keep props from piling up
    const props: {x: number; z: number}[] = [];
    const blocked = (x: number, z: number, pad = 0.1) =>
      !ok(x, z, pad) ||
      z > 6.0 ||
      (z < -29.6 && x > -2) ||
      ROADS.some((r) => inside(x, z, r, pad + 0.05)) ||
      inside(x, z, PLAZA, pad) ||
      inside(x, z, LOT_R, pad) ||
      inside(x, z, FIELD, pad) ||
      records.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) ||
      props.some((p) => Math.hypot(p.x - x, p.z - z) < 0.25);
    const treeOk = (x: number, z: number) => {
      if (blocked(x, z, 0.1)) return false;
      props.push({x, z});
      return true;
    };
    local.add(forest(seed, 'garden', [{x0: -12, x1: 12, z0: -30, z1: 3}], 90, LAND, {canopy: P.tree, trunk: P.trunk}, treeOk));
    local.add(forest(seed, 'slope', [{x0: -14, x1: -3, z0: -48, z1: -30}], 40, LAND, {canopy: P.tree, trunk: P.trunk}, treeOk, 1.2));

    // market umbrellas and tables on the plaza, away from the hero
    const poles: Item[] = [], canopies: Item[] = [], tables: Item[] = [];
    const canopyG = new THREE.ConeGeometry(1, 1, 6, 1).toNonIndexed();
    canopyG.deleteAttribute('uv');
    canopyG.translate(0, 0.5, 0);
    ([[-1.6, 4.2], [-0.35, 4.15], [-0.1, 5.6], [-1.55, 5.9]] as [number, number][]).forEach(([x, z], i) => {
      if (!ok(x, z, 0.3)) return;
      poles.push({m: mat4(x, LAND, z, 0.012, 0.17, 0.012), c: P.woodDark});
      canopies.push({m: mat4(x, LAND + 0.15, z, 0.14, 0.06, 0.14, i), c: pick(seed, `um${i}`, P.umbrella)});
      tables.push({m: mat4(x, LAND + 0.012, z, 0.2, 0.05, 0.1), c: P.wood});
    });
    local.add(instanced(ub, poles), instanced(canopyG, canopies), instanced(ub, tables));

    // crates and barrels along the quay edge, and stacked crates in the yard
    const crates: Item[] = [], barrels: Item[] = [];
    const barrelG = new THREE.CylinderGeometry(0.04, 0.04, 1, 6).toNonIndexed();
    barrelG.deleteAttribute('uv');
    barrelG.translate(0, 0.5, 0);
    for (let i = 0; i < 46; i++) {
      const x = THREE.MathUtils.lerp(-6, 6, rand(seed, `qx${i}`));
      const z = THREE.MathUtils.lerp(6.45, 7.0, rand(seed, `qz${i}`));
      if (!ok(x, z, 0.1) || PIERS.some((p) => inside(x, z, p, 0.12))) continue;
      if (i % 3 === 0) barrels.push({m: mat4(x, LAND + 0.03, z, 1, 0.08, 1), c: P.barrel});
      else crates.push({m: mat4(x, LAND + 0.03, z, 0.07, 0.06, 0.07, rand(seed, `qr${i}`) * 3), c: pick(seed, `qc${i}`, P.crate)});
    }
    if (!server) {
      for (let i = 0; i < 8; i++) {
        const x = LOT.x - 0.5 + (i % 4) * 0.33, z = LOT.z - 0.2 + Math.floor(i / 4) * 0.4;
        crates.push({m: mat4(x, LAND + 0.01, z, 0.12, 0.08, 0.1), c: pick(seed, `yc${i}`, P.crate)});
      }
    }
    local.add(instanced(ub, crates), instanced(barrelG, barrels));

    // piers
    PIERS.forEach((p, i) => {
      local.add(slab(p.x0, p.x1, p.z0, p.z1, LAND - 0.04, LAND + 0.05, P.wood));
      const posts: Item[] = [];
      for (let z = p.z0 + 0.3; z < p.z1; z += 0.5) for (const x of [p.x0 + 0.02, p.x1 - 0.02]) posts.push({m: mat4(x, WATER_Y - 0.06, z, 0.035, 0.2, 0.035), c: P.woodDark});
      local.add(instanced(ub, posts));
      if (i === 0) local.add(slab(p.x0 - 0.08, p.x1 + 0.08, p.z1 - 0.05, p.z1 + 0.1, LAND - 0.04, LAND + 0.05, P.wood));
    });

    // fishing boats moored in the basin
    const spots: [number, number, number][] = [];
    const tryBoat = (x: number, z: number, ry: number) => {
      if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 0.42) || PIERS.some((p) => inside(x, z, p, 0.2))) return;
      spots.push([x, z, ry]);
    };
    for (let i = 0; i < 8; i++) tryBoat(-3.5 + i * 0.9, 7.6 + rand(seed, `bq${i}`) * 0.1, (rand(seed, `bqr${i}`) - 0.5) * 0.2);
    for (let i = 0; i < 60; i++) tryBoat(THREE.MathUtils.lerp(-3.5, 3.5, rand(seed, `bx${i}`)), THREE.MathUtils.lerp(7.9, 11.2, rand(seed, `bz${i}`)), (rand(seed, `br${i}`) - 0.5) * 0.5);
    const hulls: Item[] = [], cabins: Item[] = [], masts: Item[] = [];
    spots.forEach(([x, z, ry], i) => {
      hulls.push({m: mat4(x, WATER_Y - 0.03, z, 0.32, 0.07, 0.11, ry), c: pick(seed, `bh${i}`, P.hull)});
      const dx = 0.06;
      cabins.push({m: mat4(x + dx * Math.cos(ry), WATER_Y + 0.04, z - dx * Math.sin(ry), 0.09, 0.07, 0.08, ry), c: P.white});
      if (i % 3 === 0) masts.push({m: mat4(x - dx * Math.cos(ry), WATER_Y + 0.04, z + dx * Math.sin(ry), 0.012, 0.22, 0.012), c: P.woodDark});
    });
    local.add(instanced(unit, hulls), instanced(unit, cabins), instanced(ub, masts));

    // breakwater arm with the striped lighthouse at its end, in the accent colour
    local.add(slab(2.4, 3.0, -58, -29, -1, LAND + 0.15, P.stone));
    local.add(slab(2.0, 3.4, -60, -55, -1, LAND + 0.15, P.stone));
    const cyl = (rt: number, rb: number, h: number, y: number, color: string, sides = 8) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, sides).toNonIndexed();
      g.deleteAttribute('uv');
      const m = new THREE.Mesh(g, flat(col(color)));
      m.position.set(LH.x, y + h / 2, LH.z);
      m.castShadow = m.receiveShadow = true;
      local.add(m);
    };
    const base = LAND + 0.15;
    cyl(0.8, 0.9, 0.4, base, P.stone);
    for (let i = 0; i < 6; i++) {
      const rb = 0.66 - i * 0.042;
      cyl(rb - 0.042, rb, 0.95, base + 0.4 + i * 0.95, i % 2 === 0 ? accent : P.white);
    }
    const top = base + 0.4 + 6 * 0.95;
    cyl(0.62, 0.62, 0.1, top, P.stone);
    cyl(0.3, 0.3, 0.5, top + 0.1, P.glass);
    const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 8, 1).toNonIndexed(), flat(col(accent)));
    lanternRoof.position.set(LH.x, top + 0.6 + 0.25, LH.z);
    lanternRoof.castShadow = true;
    local.add(lanternRoof);

    // hazy far layer: green hills behind the town, mountains, low islands on the open sea
    const hills = new THREE.Group();
    ([[-9, -64, 15, 7], [-24, -52, 10, 4.5], [-30, -75, 14, 6]] as [number, number, number, number][]).forEach(([x, z, r, h], i) => {
      const m = new THREE.Mesh(hill(seed, `hn${i}`, r, h, 7), flat(col(i === 0 ? P.hillNear : P.hillMid)));
      m.position.set(x, LAND - 0.2, z);
      m.receiveShadow = true;
      hills.add(m);
    });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(hill(seed, `hf${i}`, 12 + rand(seed, `hfr${i}`) * 8, 3 + rand(seed, `hfh${i}`) * 3, 6), flat(col(i % 2 ? P.hillFar : P.hillHaze)));
      m.position.set(-100 + i * 12 + rand(seed, `hfx${i}`) * 5, LAND - 0.2, -120 - rand(seed, `hfz${i}`) * 50);
      hills.add(m);
    }
    ([[28, -110, 10, 1.8], [60, -135, 14, 2.4]] as [number, number, number, number][]).forEach(([x, z, r, h], i) => {
      const m = new THREE.Mesh(hill(seed, `is${i}`, r, h, 6), flat(col(P.hillHaze)));
      m.position.set(x, LAND - 0.25, z);
      hills.add(m);
    });
    local.add(hills);

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records,
      walk: [
        PLAZA,
        {x0: -8, x1: 8, z0: 6.35, z1: 7.1},
        {x0: -12, x1: 12, z0: 2.08, z1: 2.32},
        {x0: -0.88, x1: -0.62, z0: -29, z1: 3.8},
        {x0: PIERS[0].x0 + 0.02, x1: PIERS[0].x1 - 0.02, z0: 7.3, z1: 9.7, y: LAND + 0.05},
        FIELD,
      ],
      snow: [{x0: -90, x1: 90, z0: -30, z1: 7.2}, {x0: -90, x1: -2, z0: -50, z1: -30}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -16,
        ok: (w) => {
          const x = w.x, z = w.z + 6;
          if (z > 5.5 || (z < -29 && x > -2)) return false;
          return !records.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.25 && Math.abs(z - b.z) < b.d / 2 + 0.25) && !props.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3);
        },
      },
    };
  },
};
