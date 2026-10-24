// Antarctica Station B: a research station on a broad white ice shelf. A bay of dark sea cuts in from the
// left behind the foreground, with a short wooden dock on its far shore; the red-roofed main base (accent)
// stands on the right, orange cabins line a snow track, penguins and seals crowd the ice up front, and
// icebergs drift in the dark sea behind rocky snow-dusted hills and a hazy far shelf.
// Frame (yaw 0): local z = world z + 6. Bay: local x < -0.9 and z < -2.5. Shelf edge at local z -45.
import {THREE, box, carGeometry, chamferBox, col, flat, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Building, Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const PLAZA: Rect = {x0: -1.6, x1: 0.2, z0: 3.6, z1: 6.4};
const LOT = {x: 1.3, z: 0.6, hx: 0.6, hz: 0.45};
const ROAD = {x0: 0.275, x1: 0.625};
const XST = 7.6; // cross track
const SPUR = -4.775; // spur track to the base
const BAY = {x: -0.9, z: -2.5};
const EDGE = -45;
const BASE = {x: 1.9, z: -5.9, w: 1.5, d: 0.85};
const PIER_Z = -4.5;
const HILLS = [
  {x: 5.0, z: -27, r: 2.4, h: 1.5},
  {x: 8.5, z: -33, r: 3.2, h: 2.2},
  {x: 3.8, z: -39, r: 3.0, h: 1.9},
  {x: 12, z: -26, r: 3.4, h: 2.0},
  {x: 1.8, z: -41, r: 2.8, h: 1.8},
  {x: 15, z: -38, r: 4.0, h: 2.6},
  {x: 18, z: -28, r: 3.6, h: 2.2},
];

const inRect = (R: Rect, x: number, z: number, m: number) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
const inBay = (x: number, z: number) => x < BAY.x && z < BAY.z;

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
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.4 && Math.abs(z - LOT.z) < LOT.hz + 0.4;

    // dark sea just under the ice: water acts flood the shelf from below
    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-70, 70, BAY.z, 30, -1, LAND, P.ice));
    local.add(slab(BAY.x, 70, EDGE, BAY.z, -1, LAND, P.ice));
    local.add(slab(-220, 220, -190, -95, -1, LAND, P.iceFar));

    // packed-snow plaza, tracks, base apron
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.plaza));
    local.add(slab(ROAD.x0, ROAD.x1, SPUR - 0.175, 14, LAND, LAND + 0.008, P.road));
    local.add(slab(-12, 12, XST - 0.175, XST + 0.175, LAND, LAND + 0.008, P.road));
    local.add(slab(ROAD.x0, BASE.x + 0.2, SPUR - 0.175, SPUR + 0.175, LAND, LAND + 0.008, P.road));
    local.add(slab(BASE.x - 1.0, BASE.x + 1.0, BASE.z - 0.8, SPUR - 0.175, LAND, LAND + 0.006, P.plaza));

    // hairline cracks in the ice
    const cracks: [number, number, number][] = [[-2.3, -1.4, 2.9], [-1.9, -0.8, 9.2], [1.0, 2.3, 9.0], [1.2, 2.2, 3.1], [-1.6, -1.0, 0.5]];
    for (const [x0, x1, z] of cracks) local.add(slab(x0, x1, z - 0.015, z + 0.015, LAND, LAND + 0.006, P.crack));

    // wooden dock into the bay, T-head, posts, a boat
    local.add(slab(-3.5, BAY.x + 0.05, PIER_Z - 0.14, PIER_Z + 0.14, LAND - 0.02, LAND + 0.02, P.wood));
    local.add(slab(-3.75, -3.25, PIER_Z - 0.3, PIER_Z + 0.3, LAND - 0.02, LAND + 0.02, P.wood));
    const posts: Item[] = [];
    for (const px of [-3.3, -2.7, -2.1, -1.5]) for (const dz of [-0.14, 0.14]) posts.push({m: mat4(px, -0.15, PIER_Z + dz, 1, 1, 1), c: P.woodDark});
    for (const dz of [-0.3, 0.3]) posts.push({m: mat4(-3.75, -0.15, PIER_Z + dz, 1, 1, 1), c: P.woodDark});
    local.add(instanced(box(0.035, 0.5, 0.035), posts));
    local.add(instanced(chamferBox(1, 1, 1, 0.01), [{m: mat4(-2.4, -0.02, -3.85, 0.32, 0.07, 0.13, 0.15), c: P.boat}]));

    // orange cabins with snowy hip roofs
    const spots: [number, number][] = [
      [1.0, 9.6], [0.95, 8.5], [1.0, 6.5], [0.95, 5.5], [1.05, 4.4], [0.95, 3.3], [1.2, 2.3], [1.95, 2.0], [2.3, 0.4], [1.0, -1.0],
      [-0.05, 9.7], [-0.05, 8.6], [-0.1, 2.8], [-0.1, 1.6], [-0.15, 0.2], [-0.1, -1.0], [-1.3, 9.2], [-1.6, 2.2], [-1.0, 1.0],
      [2.4, -2.0], [1.5, -3.1], [3.0, -3.3],
    ];
    const cabins: Building[] = [];
    const cabinItems: Item[] = [];
    spots.forEach(([sx, sz], i) => {
      const x = sx + (rand(seed, `cx${i}`) - 0.5) * 0.12;
      const z = sz + (rand(seed, `cz${i}`) - 0.5) * 0.12;
      if (!ok(x, z, 0.35) || onLot(x, z) || inBay(x, z)) return;
      const w = 0.42 + rand(seed, `cw${i}`) * 0.16, d = 0.34 + rand(seed, `cd${i}`) * 0.14, h = 0.2 + rand(seed, `ch${i}`) * 0.12;
      cabins.push({x, z, w, h, d, far: false});
      cabinItems.push({m: mat4(x, LAND, z, w, h, d), c: pick(seed, `cc${i}`, P.cabin) as string});
    });
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), cabinItems);
    local.add(buildings);

    const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).toNonIndexed();
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, 0.5, 0);
    roofGeo.deleteAttribute('uv');
    const roofs = cabins.map((b, i) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.1, 0.12, b.d * 1.1), c: pick(seed, `rf${i}`, [P.roofSnow, P.roofSnow, P.roofDark]) as string}));
    if (roofs.length) local.add(instanced(roofGeo, roofs));
    const cabinWindows = cabins.map((b) => ({m: mat4(b.x, LAND + b.h * 0.3, b.z + b.d / 2, b.w * 0.28, b.h * 0.35, 0.012), c: P.window}));
    if (cabinWindows.length) local.add(instanced(box(1, 1, 1), cabinWindows, false));

    const onBld = (x: number, z: number, pad: number) =>
      cabins.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) ||
      (Math.abs(x - BASE.x) < BASE.w / 2 + 0.5 + pad && z < BASE.z + BASE.d / 2 + 0.9 + pad && z > BASE.z - 1.1 - pad);
    const onRoad = (x: number, z: number) =>
      (x > ROAD.x0 - 0.1 && x < ROAD.x1 + 0.1 && z > SPUR - 0.3) || Math.abs(z - XST) < 0.3 || (Math.abs(z - SPUR) < 0.3 && x > 0.2 && x < BASE.x + 0.3);
    const freeAt = (x: number, z: number, pad: number) =>
      !inBay(x, z) && !onBld(x, z, pad) && !inRect(PLAZA, x, z, 0.1) && !onRoad(x, z) && !onLot(x, z) && ok(x, z, 0.3);

    // main base: pale walls, accent roofs, a taller block, front windows
    local.add(mesh(chamferBox(BASE.w, 0.4, BASE.d, 0.02), P.baseWall, BASE.x, LAND, BASE.z));
    const baseRoof = mesh(roofGeo, accent, BASE.x, LAND + 0.4, BASE.z);
    baseRoof.scale.set(BASE.w * 1.1, 0.34, BASE.d * 1.12);
    local.add(baseRoof);
    local.add(mesh(chamferBox(0.7, 0.3, 0.5, 0.02), P.baseWall, BASE.x - 0.3, LAND, BASE.z - 0.75));
    const annexRoof = mesh(roofGeo, accent, BASE.x - 0.3, LAND + 0.3, BASE.z - 0.75);
    annexRoof.scale.set(0.78, 0.22, 0.58);
    local.add(annexRoof);
    local.add(mesh(chamferBox(0.3, 0.78, 0.3, 0.02), P.baseWall, BASE.x + 0.35, LAND, BASE.z - 0.1));
    const towerRoof = mesh(roofGeo, accent, BASE.x + 0.35, LAND + 0.78, BASE.z - 0.1);
    towerRoof.scale.set(0.38, 0.22, 0.38);
    local.add(towerRoof);
    const baseWindows: Item[] = [];
    for (let i = 0; i < 5; i++) baseWindows.push({m: mat4(BASE.x - 0.56 + i * 0.28, LAND + 0.15, BASE.z + BASE.d / 2 + 0.004, 0.13, 0.12, 0.012), c: P.window});
    local.add(instanced(box(1, 1, 1), baseWindows, false));

    // radio masts with cross arms and beacons
    const mastSpots: [number, number, number][] = [[1.45, 2.0, 0.8], [0.95, -2.7, 1.1], [3.0, -5.2, 1.4], [0.85, -6.6, 1.2], [-0.6, -1.2, 0.9]];
    const masts: Item[] = [], arms: Item[] = [], beacons: Item[] = [];
    mastSpots.forEach(([x, z, h]) => {
      if (!ok(x, z, 0.2) || onLot(x, z)) return;
      masts.push({m: mat4(x, LAND, z, 1, h, 1), c: P.mast});
      arms.push({m: mat4(x, LAND + h * 0.8, z, 1, 1, 1), c: P.mast});
      arms.push({m: mat4(x, LAND + h * 0.58, z, 0.65, 1, 1), c: P.mast});
      beacons.push({m: mat4(x, LAND + h, z, 1, 1, 1), c: P.beacon});
    });
    if (masts.length) {
      local.add(instanced(box(0.025, 1, 0.025), masts));
      local.add(instanced(box(0.2, 0.015, 0.015), arms));
      local.add(instanced(box(0.045, 0.045, 0.045), beacons, false));
    }

    // marker poles with little flags along the main track
    const poles: Item[] = [], flags: Item[] = [];
    for (let k = 0; k < 17; k++) {
      const z = 11 - k * 0.95, x = 0.78;
      if (onBld(x, z, 0.05) || onLot(x, z) || !ok(x, z, 0.1)) continue;
      poles.push({m: mat4(x, LAND, z, 1, 1, 1), c: P.mast});
      flags.push({m: mat4(x + 0.03, LAND + 0.17, z, 1, 1, 1), c: P.flag});
    }
    if (poles.length) {
      local.add(instanced(box(0.012, 0.22, 0.012), poles, false));
      local.add(instanced(box(0.06, 0.04, 0.006), flags, false));
    }

    // fuel drums beside cabins and on the dock, crates, snow vehicles
    const drumGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6).toNonIndexed();
    drumGeo.translate(0, 0.04, 0);
    const drums: Item[] = [];
    cabins.forEach((b, i) => {
      if (i % 3 !== 0) return;
      for (let k = 0; k < 2; k++) {
        const x = b.x + b.w / 2 + 0.07 + k * 0.07, z = b.z + b.d / 2 - 0.05;
        if (ok(x, z, 0.1) && !onLot(x, z)) drums.push({m: mat4(x, LAND, z, 1, 1, 1), c: pick(seed, `dr${i}${k}`, P.drum) as string});
      }
    });
    drums.push({m: mat4(-1.3, LAND + 0.02, PIER_Z - 0.04, 1, 1, 1), c: P.drum[1]}, {m: mat4(-1.45, LAND + 0.02, PIER_Z + 0.05, 1, 1, 1), c: P.drum[0]});
    local.add(instanced(drumGeo, drums));
    local.add(instanced(chamferBox(1, 1, 1, 0.01), [
      {m: mat4(-1.9, LAND + 0.02, PIER_Z + 0.03, 0.09, 0.08, 0.09), c: P.crate},
      {m: mat4(-2.05, LAND + 0.02, PIER_Z - 0.04, 0.08, 0.06, 0.08, 0.4), c: P.crate},
    ]));
    const rigs: [number, number, number][] = [[0.45, 10.3, Math.PI / 2], [0.45, 2.6, Math.PI / 2], [0.45, -2.0, Math.PI / 2], [-0.45, XST, 0]];
    const vehicles: Item[] = [];
    rigs.forEach(([x, z, ry], i) => {
      if (ok(x, z, 0.2)) vehicles.push({m: mat4(x, LAND + 0.01, z, 1, 1, 1, ry), c: P.vehicle[i % P.vehicle.length]});
    });
    if (vehicles.length) local.add(instanced(carGeometry(), vehicles));

    // wind-drifted mounds and dark rocks scattered over the ice
    const ico = new THREE.IcosahedronGeometry(1, 0);
    ico.deleteAttribute('uv');
    const mounds: Item[] = [], rocks: Item[] = [];
    for (let i = 0; i < 90; i++) {
      const near = i % 2 === 0;
      const x = near ? THREE.MathUtils.lerp(-2.8, 3.2, rand(seed, `mx${i}`)) : THREE.MathUtils.lerp(-0.8, 9, rand(seed, `mx${i}`));
      const z = near ? THREE.MathUtils.lerp(-2.4, 11.5, rand(seed, `mz${i}`)) : THREE.MathUtils.lerp(-40, -3, rand(seed, `mz${i}`));
      if (!freeAt(x, z, 0.2) || HILLS.some((hl) => Math.hypot(x - hl.x, z - hl.z) < hl.r * 0.9)) continue;
      const f = 1 + Math.max(0, -z) * 0.04;
      mounds.push({m: mat4(x, LAND, z, (0.18 + rand(seed, `ms${i}`) * 0.25) * f, (0.04 + rand(seed, `mh${i}`) * 0.05) * f, (0.14 + rand(seed, `md${i}`) * 0.18) * f, rand(seed, `mr${i}`) * 6.28), c: pick(seed, `mc${i}`, P.mound) as string});
    }
    for (let i = 0; i < 44; i++) {
      const near = i % 3 !== 0;
      const x = near ? THREE.MathUtils.lerp(-2.8, 3.2, rand(seed, `kx${i}`)) : THREE.MathUtils.lerp(-0.8, 9, rand(seed, `kx${i}`));
      const z = near ? THREE.MathUtils.lerp(-2.4, 11.5, rand(seed, `kz${i}`)) : THREE.MathUtils.lerp(-40, -3, rand(seed, `kz${i}`));
      if (!freeAt(x, z, 0.15) || HILLS.some((hl) => Math.hypot(x - hl.x, z - hl.z) < hl.r * 0.9)) continue;
      const s = (0.04 + rand(seed, `ks${i}`) * 0.05) * (1 + Math.max(0, -z) * 0.04);
      rocks.push({m: mat4(x, LAND + s * 0.2, z, s * 1.2, s * 0.8, s, rand(seed, `kr${i}`) * 6.28), c: pick(seed, `kc${i}`, P.rock) as string});
    }
    if (mounds.length) local.add(instanced(ico, mounds, false));
    if (rocks.length) local.add(instanced(ico, rocks));

    // penguin colonies: body, belly, head, beak
    const bodyI: Item[] = [], bellyI: Item[] = [], headI: Item[] = [], beakI: Item[] = [];
    const colonies: [number, number, number, number, number][] = [[-0.5, 10.0, 0.45, 12, 0.3], [-0.95, 6.9, 0.5, 9, -0.4], [-1.7, 0.3, 0.6, 10, 0.6], [-1.5, -1.6, 0.45, 8, 1.0], [2.2, -0.9, 0.5, 8, -0.3]];
    const placed: [number, number][] = [];
    colonies.forEach(([cx, cz, R, n, yaw], g) => {
      for (let i = 0; i < n; i++) {
        const a = rand(seed, `pa${g}_${i}`) * 6.283, rr = R * Math.sqrt(rand(seed, `pr${g}_${i}`));
        const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (!freeAt(x, z, 0.08) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.08)) continue;
        placed.push([x, z]);
        const s = 0.8 + rand(seed, `ps${g}_${i}`) * 0.3;
        const ry = yaw + (rand(seed, `py${g}_${i}`) - 0.5) * 2.5;
        const sn = Math.sin(ry), cs = Math.cos(ry);
        bodyI.push({m: mat4(x, LAND + 0.05 * s, z, 0.034 * s, 0.058 * s, 0.03 * s, ry), c: P.pengBody});
        bellyI.push({m: mat4(x + sn * 0.012 * s, LAND + 0.052 * s, z + cs * 0.012 * s, 0.027 * s, 0.047 * s, 0.022 * s, ry), c: P.pengBelly});
        headI.push({m: mat4(x + sn * 0.004 * s, LAND + 0.112 * s, z + cs * 0.004 * s, 0.024 * s, 0.024 * s, 0.024 * s, ry), c: P.pengBody});
        beakI.push({m: mat4(x + sn * 0.03 * s, LAND + 0.108 * s, z + cs * 0.03 * s, 0.008 * s, 0.008 * s, 0.03 * s, ry), c: P.beak});
      }
    });
    const beakGeo = new THREE.ConeGeometry(1, 1, 4, 1).toNonIndexed();
    beakGeo.rotateX(Math.PI / 2);
    beakGeo.deleteAttribute('uv');
    if (bodyI.length) local.add(instanced(ico, bodyI), instanced(ico, bellyI, false), instanced(ico, headI), instanced(beakGeo, beakI, false));

    // a few seals lying on the ice
    const sealSpots: [number, number, number][] = [[-1.0, 8.4, 0.5], [-1.9, 1.9, -0.4], [-1.4, -1.8, 1.2], [-0.2, 10.2, -0.3]];
    const sealBody: Item[] = [], sealHead: Item[] = [];
    sealSpots.forEach(([x, z, ry], i) => {
      if (!freeAt(x, z, 0.2)) return;
      const c = pick(seed, `sl${i}`, P.seal) as string;
      const s = 0.9 + rand(seed, `ss${i}`) * 0.3;
      sealBody.push({m: mat4(x, LAND + 0.035, z, 0.14 * s, 0.05 * s, 0.055 * s, ry), c});
      sealHead.push({m: mat4(x + Math.cos(ry) * 0.13 * s, LAND + 0.04, z - Math.sin(ry) * 0.13 * s, 0.04 * s, 0.035 * s, 0.035 * s, ry), c});
    });
    if (sealBody.length) local.add(instanced(ico, sealBody), instanced(ico, sealHead));

    // rocky snow-dusted hills on the shelf, and distant peaks on the far shelf
    const peak = (key: string, x: number, z: number, r: number, h: number, sides: number, rock: string) => {
      local.add(mesh(hill(seed, key, r, h, sides), rock, x, LAND - 0.2, z));
      const f = 0.38;
      const capG = new THREE.ConeGeometry(r * f * 1.12, h * f, sides, 1).toNonIndexed();
      capG.deleteAttribute('uv');
      capG.translate(0, (h * f) / 2, 0);
      local.add(mesh(capG, P.snowcap, x, LAND - 0.2 + h * (1 - f) * 0.985, z));
    };
    HILLS.forEach((hl, i) => peak(`hl${i}`, hl.x, hl.z, hl.r, hl.h, 6 + (i % 2), P.hillRock));
    for (let i = 0; i < 9; i++) {
      peak(`mt${i}`, -48 + i * 12 + rand(seed, `mtx${i}`) * 4, -110 - rand(seed, `mtz${i}`) * 12, 8 + rand(seed, `mtr${i}`) * 4, 5 + rand(seed, `mth${i}`) * 4, 5 + Math.floor(rand(seed, `mts${i}`) * 3), P.mtn);
    }
    for (let i = 0; i < 9; i++) {
      peak(`mf${i}`, -55 + i * 14 + rand(seed, `mfx${i}`) * 4, -150 - rand(seed, `mfz${i}`) * 14, 9 + rand(seed, `mfr${i}`) * 4, 6 + rand(seed, `mfh${i}`) * 4, 5 + Math.floor(rand(seed, `mfs${i}`) * 3), P.mtnFar);
    }

    // icebergs: tabular bergs with a turquoise foot, plus a few peaked ones
    const bergs: Item[] = [], feet: Item[] = [];
    const addBerg = (x: number, z: number, w: number, h: number, d: number, i: number) => {
      const ry = (rand(seed, `bry${i}`) - 0.5) * 0.6;
      bergs.push({m: mat4(x, -0.2, z, w, h, d, ry), c: pick(seed, `bc${i}`, P.berg) as string});
      feet.push({m: mat4(x, -0.1, z, w * 1.1, 0.115, d * 1.1, ry), c: P.bergFoot});
    };
    const bayBergs: [number, number, number, number, number][] = [[-2.6, -6.5, 1.0, 0.45, 0.7], [-3.4, -10, 1.4, 0.55, 0.9], [-2.2, -14, 0.9, 0.5, 0.7], [-5.0, -17, 1.8, 0.7, 1.1], [-3.0, -22, 2.2, 0.8, 1.4], [-6.5, -27, 2.6, 0.9, 1.6], [-2.4, -31, 1.8, 0.7, 1.2]];
    bayBergs.forEach(([x, z, w, h, d], i) => addBerg(x, z, w, h, d, i));
    for (let i = 0; i < 14; i++) {
      addBerg(-34 + i * 5 + rand(seed, `ox${i}`) * 4, -50 - rand(seed, `oz${i}`) * 45, 2.5 + rand(seed, `ow${i}`) * 3.5, 0.8 + rand(seed, `oh${i}`) * 1.0, 1.5 + rand(seed, `od${i}`) * 2.5, 20 + i);
    }
    local.add(instanced(chamferBox(1, 1, 1, 0.02), bergs), instanced(chamferBox(1, 1, 1, 0.02), feet, false));
    for (let i = 0; i < 7; i++) {
      local.add(mesh(hill(seed, `pb${i}`, 0.9 + rand(seed, `pbr${i}`) * 1.2, 1.1 + rand(seed, `pbh${i}`) * 1.2, 5), pick(seed, `pbc${i}`, P.berg) as string, -26 + i * 8 + rand(seed, `pbx${i}`) * 5, -0.25, -52 - rand(seed, `pbz${i}`) * 28));
    }

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records: cabins,
      walk: [
        PLAZA,
        {x0: ROAD.x0, x1: ROAD.x1, z0: SPUR - 0.17, z1: 14},
        {x0: -12, x1: 12, z0: XST - 0.17, z1: XST + 0.17},
        {x0: ROAD.x0, x1: BASE.x + 0.2, z0: SPUR - 0.17, z1: SPUR + 0.17},
        {x0: -3.4, x1: BAY.x, z0: PIER_Z - 0.12, z1: PIER_Z + 0.12, y: LAND + 0.02},
        {x0: -2.4, x1: -0.5, z0: 8.4, z1: 10.4},
      ],
      snow: [{x0: -70, x1: 70, z0: BAY.z, z1: 30}, {x0: BAY.x, x1: 70, z0: EDGE, z1: BAY.z}],
      lot: LOT,
      pads: {
        x0: 0,
        x1: 4.5,
        z: -19,
        ok: (w) => {
          const x = w.x, z = w.z + 6;
          return z > EDGE + 3 && x > BAY.x + 0.8 && !onBld(x, z, 0.3) && Math.hypot(x - BASE.x, z - BASE.z) > 1.4 && !HILLS.some((hl) => Math.hypot(x - hl.x, z - hl.z) < hl.r * 0.9 + 0.4);
        },
      },
    };
  },
};
