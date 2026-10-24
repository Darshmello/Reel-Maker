// Alpine Village: wooden chalets with steep roofs around a plaza and a small lake, a church whose
// steeple carries the accent colour, pine forests, green foothills and jagged snow-capped peaks.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets ground near local z 10.7 where the
// frame is only ~1.7 m wide, so the chalet columns hug the main street to fill the bottom of the shot.
import {THREE, blocks, box, chamferBox, col, flat, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

const LAND = 0.3;
const PLAZA: Rect = {x0: -1.9, x1: 0.4, z0: 3.8, z1: 6.4};
const LOT = {x: 1.3, z: 0.6, hx: 0.6, hz: 0.45};
const CH = {x: 1.0, z: 2.85};
const LAKE = {x: -1.3, z: 2.9, r: 0.8};
const XST = 6.975; // cross street, on a skipped chalet row
const LANE = -3.375; // back lane, on a skipped chalet row
const FIELDS: {r: Rect; c: string}[] = [
  {r: {x0: 2.6, x1: 4.6, z0: -2.6, z1: -0.8}, c: P.field[0]},
  {r: {x0: -5.2, x1: -3.0, z0: 0.4, z1: 2.4}, c: P.field[1]},
  {r: {x0: -4.8, x1: -2.8, z0: 8.2, z1: 10.4}, c: P.field[2]},
];

const inRect = (R: Rect, x: number, z: number, m: number) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;

export const pack: SetPack = {
  hero: {x: -0.7, z: -1, yaw: 0.2},
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

    // the sea sits just under the meadow: water acts flood the valley from below
    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-70, 70, -280, 30, -1, LAND, P.grass));

    // plaza, streets, churchyard
    local.add(slab(-12, 12, XST - 0.2, XST + 0.2, LAND, LAND + 0.008, P.road));
    local.add(slab(-12, 12, LANE - 0.2, LANE + 0.2, LAND, LAND + 0.008, P.road));
    local.add(slab(-0.2, 0.2, -14, 14, LAND, LAND + 0.008, P.road));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.plaza));
    local.add(slab(0.45, 1.6, 2.0, 3.9, LAND, LAND + 0.01, P.yard));

    // hay and crop fields with furrow stripes
    for (const f of FIELDS) {
      local.add(slab(f.r.x0, f.r.x1, f.r.z0, f.r.z1, LAND, LAND + 0.008, f.c));
      for (let s = 0; s < 4; s++) {
        const zs = f.r.z0 + ((s + 0.5) * (f.r.z1 - f.r.z0)) / 4;
        local.add(slab(f.r.x0, f.r.x1, zs - 0.04, zs + 0.04, LAND + 0.008, LAND + 0.016, P.furrow));
      }
    }

    // lake by the plaza, with a sandy rim and three boats
    local.add(mesh(new THREE.CylinderGeometry(LAKE.r + 0.07, LAKE.r + 0.07, 0.016, 9).toNonIndexed(), P.shore, LAKE.x, LAND + 0.003, LAKE.z));
    local.add(mesh(new THREE.CylinderGeometry(LAKE.r, LAKE.r, 0.02, 9).toNonIndexed(), P.lake, LAKE.x, LAND + 0.008, LAKE.z));
    const boats = [[-0.25, 0.1], [0.25, -0.2], [0.05, 0.35]].map(([dx, dz], i) => ({m: mat4(LAKE.x + dx, LAND + 0.02, LAKE.z + dz, 0.17, 0.04, 0.07, i * 0.9 + 0.3), c: P.boat[i % P.boat.length] as string}));
    local.add(instanced(chamferBox(1, 1, 1, 0.01), boats));

    // chalets: two column blocks either side of the main street, skipping plaza, lake, church, lot, fields
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.5 && Math.abs(z - LOT.z) < LOT.hz + 0.5;
    const free = (x: number, z: number) =>
      Math.abs(x) > 0.5 && Math.abs(z - XST) > 0.5 && Math.abs(z - LANE) > 0.5 &&
      !inRect(PLAZA, x, z, 0.6) && !onLot(x, z) &&
      Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 0.7 &&
      !(Math.abs(x - CH.x) < 1.0 && Math.abs(z - CH.z - 0.2) < 1.2) &&
      !FIELDS.some((f) => inRect(f.r, x, z, 0.5)) && ok(x, z, 0.5);
    const opt = {cell: 1.15, gap: 0.2, hMin: 0.2, hMax: 0.5, ok: free, heightAt: (_x: number, z: number) => THREE.MathUtils.clamp((9 - z) / 10, 0.6, 1)};
    const left = blocks(seed, 'chL', {x0: -9.475, x1: -0.3, z0: -12, z1: 12.5}, LAND, P.wall, opt);
    const right = blocks(seed, 'chR', {x0: 0.275, x1: 9.2, z0: -12, z1: 12.5}, LAND, P.wall, opt);
    const items = [...left.items, ...right.items];
    const records = [...left.records, ...right.records];
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), items);
    local.add(buildings);

    // steep hip roofs on every chalet
    const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).toNonIndexed();
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, 0.5, 0);
    roofGeo.deleteAttribute('uv');
    const roofs = records.map((b, i) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.14, 0.28 + b.w * 0.15, b.d * 1.14), c: pick(seed, `roof${i}`, P.roof) as string}));
    local.add(instanced(roofGeo, roofs));

    const onBld = (x: number, z: number, pad: number) => records.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad);

    // church: white nave, slate roof, front tower, accent steeple and cross
    const nave = mesh(chamferBox(0.5, 0.42, 0.8, 0.02), P.chWall, CH.x, LAND, CH.z);
    const naveRoof = mesh(roofGeo, P.slate, CH.x, LAND + 0.42, CH.z);
    naveRoof.scale.set(0.62, 0.3, 0.92);
    const tower = mesh(chamferBox(0.28, 0.95, 0.28, 0.02), P.chWall, CH.x, LAND, CH.z + 0.55);
    const spire = mesh(roofGeo, accent, CH.x, LAND + 0.95, CH.z + 0.55);
    spire.scale.set(0.34, 0.6, 0.34);
    const cross = mesh(box(0.02, 0.1, 0.02), accent, CH.x, LAND + 1.55, CH.z + 0.55);
    local.add(nave, naveRoof, tower, spire, cross);

    // pines: two stacked cones per tree
    const coneGeo = new THREE.ConeGeometry(0.3, 1, 6, 1).toNonIndexed();
    coneGeo.deleteAttribute('uv');
    coneGeo.translate(0, 0.5, 0);
    const pines = (key: string, rects: Rect[], n: number, okf: (x: number, z: number) => boolean) => {
      const lo: {m: THREE.Matrix4; c: string}[] = [];
      const hi: {m: THREE.Matrix4; c: string}[] = [];
      for (let i = 0; i < n; i++) {
        const R = rects[i % rects.length];
        const x = THREE.MathUtils.lerp(R.x0, R.x1, rand(seed, `${key}x${i}`));
        const z = THREE.MathUtils.lerp(R.z0, R.z1, rand(seed, `${key}z${i}`));
        if (!okf(x, z)) continue;
        const s = 0.4 + rand(seed, `${key}s${i}`) * 0.3;
        const c = pick(seed, `${key}c${i}`, P.pine) as string;
        const r = rand(seed, `${key}r${i}`) * 6.28;
        lo.push({m: mat4(x, LAND + 0.03, z, s * 0.9, s * 0.62, s * 0.9, r), c});
        hi.push({m: mat4(x, LAND + 0.03 + s * 0.3, z, s * 0.62, s * 0.6, s * 0.62, r), c});
      }
      const g = new THREE.Group();
      if (lo.length) g.add(instanced(coneGeo, lo), instanced(coneGeo, hi));
      return g;
    };

    // a few pines among the chalets
    local.add(pines('vp', [{x0: -7, x1: 7, z0: -10, z1: 11}], 170, (x, z) =>
      !onBld(x, z, 0.12) && Math.abs(x) > 0.4 && Math.abs(z - XST) > 0.35 && Math.abs(z - LANE) > 0.35 &&
      !inRect(PLAZA, x, z, 0.2) && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 0.2 &&
      !(x > 0.4 && x < 1.7 && z > 1.9 && z < 4.2) && !onLot(x, z) &&
      !FIELDS.some((f) => inRect(f.r, x, z, 0.1)) && ok(x, z, 0.25)));

    // pine forests either side, keeping a meadow clearing behind the village for rocket pads
    const clearing = (x: number, z: number) => x > -4.2 && x < 5.8 && z < -12.3 && z > -36;
    const wood = (x: number, z: number) => !clearing(x, z) && !onBld(x, z, 0.1) && !(Math.abs(x) < 0.6 && z > -15) && !FIELDS.some((f) => inRect(f.r, x, z, 0.1)) && ok(x, z, 0.3);
    local.add(pines('fw', [{x0: -18, x1: -3.5, z0: -36, z1: -9}, {x0: 4.5, x1: 18, z0: -36, z1: -9}], 520, wood));
    local.add(pines('fd', [{x0: -40, x1: 40, z0: -75, z1: -38}], 260, wood));

    // green foothills, then two ranges of jagged snow-capped peaks fading into the haze
    for (let i = 0; i < 8; i++) {
      const g = hill(seed, `foot${i}`, 6 + rand(seed, `fr${i}`) * 3, 2 + rand(seed, `fh${i}`) * 1.5, 7);
      local.add(mesh(g, P.foot, -32 + i * 9 + rand(seed, `fx${i}`) * 4, LAND - 0.2, -76 - rand(seed, `fz${i}`) * 12));
    }
    const peak = (key: string, x: number, z: number, r: number, h: number, sides: number, rock: string) => {
      local.add(mesh(hill(seed, key, r, h, sides), rock, x, LAND - 0.2, z));
      const f = 0.4;
      const capG = new THREE.ConeGeometry(r * f * 1.12, h * f, sides, 1).toNonIndexed();
      capG.deleteAttribute('uv');
      capG.translate(0, (h * f) / 2, 0);
      local.add(mesh(capG, P.snowcap, x, LAND - 0.2 + h * (1 - f) * 0.985, z));
    };
    for (let i = 0; i < 9; i++) {
      peak(`pk${i}`, -34 + i * 8.5 + rand(seed, `px${i}`) * 3, -105 - rand(seed, `pz${i}`) * 10, 6 + rand(seed, `pr${i}`) * 2.5, 4 + rand(seed, `ph${i}`) * 2.5, 5 + Math.floor(rand(seed, `ps${i}`) * 3), P.rock);
    }
    for (let i = 0; i < 9; i++) {
      peak(`pf${i}`, -42 + i * 10.5 + rand(seed, `fqx${i}`) * 4, -150 - rand(seed, `fqz${i}`) * 12, 7 + rand(seed, `fqr${i}`) * 3, 6 + rand(seed, `fqh${i}`) * 2.8, 5 + Math.floor(rand(seed, `fqs${i}`) * 3), P.rockFar);
    }

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
        {x0: -12, x1: 12, z0: XST - 0.2, z1: XST + 0.2},
        {x0: -0.2, x1: 0.2, z0: -14, z1: 14},
        {x0: -12, x1: 12, z0: LANE - 0.2, z1: LANE + 0.2},
        FIELDS[0].r,
        FIELDS[1].r,
      ],
      snow: [{x0: -70, x1: 70, z0: -280, z1: 30}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -19,
        ok: (w) => !onBld(w.x, w.z + 6, 0.3) && Math.hypot(w.x - CH.x, w.z + 6 - CH.z) > 1,
      },
    };
  },
};
