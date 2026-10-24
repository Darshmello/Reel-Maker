// Antarctica Station: a research base on a broad white ice shelf. The main base with its accent-coloured
// roof is the landmark; orange cabins, radio masts, a wooden dock, penguins and seals fill the foreground,
// snow-dusted rocky hills frame the sides and icebergs drift in the dark sea behind the shelf edge.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets the ground near local z 10.7 where the
// frame is only ~1.7 m wide, so the small props crowd the centre column near the camera.
import {THREE, box, carGeometry, chamferBox, col, flat, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Building, Rect, SetPack} from '../kit';
import {P} from './palette';

const LAND = 0.3;
const EDGE = -18; // shelf edge, local z: open sea beyond
const PLAZA: Rect = {x0: -1.9, x1: 0.4, z0: 3.8, z1: 6.4};
const LOT = {x: 1.3, z: 0.6, hx: 0.6, hz: 0.45};
const FIELD: Rect = {x0: -2.5, x1: -1.0, z0: -1.8, z1: 1.6};
const BASE = {x: -0.55, z: -3.6};
const NS = 0.6; // north-south track
const CROSS = [2.75, 8.5, -6.2]; // cross tracks
const DOCKX = 1.4;
const MASTS = [{x: 0.95, z: -3.0, h: 1.5}, {x: -2.2, z: -2.6, h: 1.1}, {x: 1.9, z: -7.0, h: 1.3}];
const NEAR_HILLS = [
  {x: -6.6, z: -11, r: 2.4, h: 1.5, s: 6},
  {x: 7.0, z: -10, r: 2.6, h: 1.9, s: 7},
  {x: -12, z: -14, r: 3.5, h: 2.8, s: 6},
  {x: 13, z: -14, r: 3.8, h: 3.2, s: 7},
];

const inRect = (R: Rect, x: number, z: number, m: number) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
const onLot = (x: number, z: number, m: number) => Math.abs(x - LOT.x) < LOT.hx + m && Math.abs(z - LOT.z) < LOT.hz + m;
const onBase = (x: number, z: number, m: number) => x > -1.95 - m && x < 0.2 + m && Math.abs(z - BASE.z) < 0.35 + m;
const roadAt = (x: number, z: number, m: number) => Math.abs(x - NS) < 0.15 + m || CROSS.some((c) => Math.abs(z - c) < 0.15 + m) || (x > 1.25 - m && x < 1.55 + m && z < -5.9);
const nearHill = (x: number, z: number, m: number) => NEAR_HILLS.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + m);

export const pack: SetPack = {
  hero: {x: -0.7, z: -1, yaw: 0.2},
  build: ({seed, accent, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);

    const mesh = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(g, flat(col(color)));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const unit = box(1, 1, 1);
    const inst = (geo: THREE.BufferGeometry, ms: THREE.Matrix4[], c: string) => instanced(geo, ms.map((m) => ({m, c})));

    // dark sea just under the shelf: water acts flood the ice from below
    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-140, 140, EDGE, 30, -1, LAND, P.ice));
    local.add(slab(-140, 140, EDGE, EDGE + 0.5, LAND, LAND + 0.004, P.rim));
    local.add(slab(-200, 200, -200, -120, -1, LAND, P.ice)); // far coast of the ice

    // pale blue ice patches
    for (let i = 0; i < 16; i++) {
      const near = i >= 10;
      const x = THREE.MathUtils.lerp(near ? -2.4 : -8, near ? 2.4 : 8, rand(seed, `px${i}`));
      const z = near ? THREE.MathUtils.lerp(7, 11.5, rand(seed, `pz${i}`)) : THREE.MathUtils.lerp(-16, -7, rand(seed, `pz${i}`));
      const w = 0.5 + rand(seed, `pw${i}`) * 1.6, d = 0.3 + rand(seed, `pd${i}`) * 0.6;
      local.add(slab(x - w / 2, x + w / 2, z - d / 2, z + d / 2, LAND, LAND + 0.004, P.iceB));
    }

    // plaza, yard, tracks
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.plaza));
    local.add(slab(LOT.x - LOT.hx, LOT.x + LOT.hx, LOT.z - LOT.hz, LOT.z + LOT.hz, LAND, LAND + 0.006, P.yard));
    local.add(slab(NS - 0.15, NS + 0.15, -14, 14, LAND, LAND + 0.008, P.track));
    for (const c of CROSS) local.add(slab(-12, 12, c - 0.15, c + 0.15, LAND, LAND + 0.008, P.track));
    local.add(slab(1.25, 1.55, EDGE, -6.2, LAND, LAND + 0.008, P.track)); // path to the dock

    // cabins: a few hand-placed near the camera, then a thinned grid over the station
    const cabins: Building[] = [];
    const extras = [[1.15, 9.7, 0.4, 0.2, 0.3], [1.35, 6.6, 0.42, 0.22, 0.32], [-1.35, 10.2, 0.36, 0.18, 0.28], [1.3, 3.9, 0.4, 0.2, 0.3]];
    for (const [x, z, w, h, d] of extras) if (ok(x, z, 0.3)) cabins.push({x, z, w, h, d, far: false});
    const free = (x: number, z: number) =>
      !inRect(PLAZA, x, z, 0.6) && !inRect(FIELD, x, z, 0.3) && !roadAt(x, z, 0.3) && !onLot(x, z, 0.5) && !onBase(x, z, 0.5) &&
      !MASTS.some((m) => Math.hypot(x - m.x, z - m.z) < 0.5) && !nearHill(x, z, 0.3) && z < 12.2 && ok(x, z, 0.45);
    for (let j = 0; j < 32; j++) {
      for (let i = 0; i < 15; i++) {
        const k = `${i}:${j}`;
        if (rand(seed, `cg${k}`) < 0.5) continue;
        const x = -5.4 + i * 0.75 + (rand(seed, `cx${k}`) - 0.5) * 0.2;
        const z = -12 + j * 0.8 + (rand(seed, `cz${k}`) - 0.5) * 0.25;
        if (!free(x, z)) continue;
        const w = 0.3 + rand(seed, `cw${k}`) * 0.2, d = 0.25 + rand(seed, `cd${k}`) * 0.15, h = 0.15 + rand(seed, `ch${k}`) * 0.1;
        if (cabins.some((b) => Math.abs(x - b.x) < (b.w + w) / 2 + 0.05 && Math.abs(z - b.z) < (b.d + d) / 2 + 0.05)) continue;
        cabins.push({x, z, w, h, d, far: false});
      }
    }
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), cabins.map((b, i) => ({m: mat4(b.x, LAND, b.z, b.w, b.h, b.d), c: pick(seed, `cc${i}`, P.cabin) as string})));
    local.add(buildings);

    // gable roofs: ridge along z, turned for cabins that are longer in x
    const tri = new THREE.Shape();
    tri.moveTo(-0.5, 0);
    tri.lineTo(0.5, 0);
    tri.lineTo(0, 1);
    tri.closePath();
    const gable = new THREE.ExtrudeGeometry(tri, {depth: 1, bevelEnabled: false});
    gable.translate(0, 0, -0.5);
    gable.deleteAttribute('uv');
    const onBld = (x: number, z: number, pad: number) => cabins.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad);
    local.add(instanced(gable, cabins.map((b, i) => ({
      m: b.w >= b.d ? mat4(b.x, LAND + b.h, b.z, b.d * 1.2, 0.09, b.w * 1.2, Math.PI / 2) : mat4(b.x, LAND + b.h, b.z, b.w * 1.2, 0.09, b.d * 1.2),
      c: pick(seed, `cr${i}`, P.cabinRoof) as string,
    }))));

    // main base: the landmark, accent roofs, windows, radome
    local.add(mesh(chamferBox(1.5, 0.34, 0.62, 0.02), P.baseWall, BASE.x, LAND, BASE.z));
    local.add(mesh(chamferBox(0.55, 0.28, 0.5, 0.02), P.baseWall2, -1.55, LAND, BASE.z + 0.04));
    const roof = mesh(gable, accent, BASE.x, LAND + 0.34, BASE.z);
    roof.rotation.y = Math.PI / 2;
    roof.scale.set(0.62 * 1.18, 0.24, 1.5 * 1.06);
    const wingRoof = mesh(gable, accent, -1.55, LAND + 0.28, BASE.z + 0.04);
    wingRoof.scale.set(0.55 * 1.15, 0.2, 0.5 * 1.1);
    local.add(roof, wingRoof);
    local.add(mesh(box(0.08, 0.14, 0.08), P.chimney, BASE.x + 0.45, LAND + 0.4, BASE.z));
    const wins: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 6; i++) wins.push({m: mat4(BASE.x - 0.6 + i * 0.24, LAND + 0.12, BASE.z + 0.315, 0.1, 0.08, 0.012), c: P.window});
    wins.push({m: mat4(BASE.x + 0.6, LAND, BASE.z + 0.315, 0.1, 0.16, 0.012), c: P.door});
    local.add(instanced(unit, wins));
    local.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 8).toNonIndexed(), P.domeBase, -1.0, LAND + 0.05, -5.0));
    local.add(mesh(new THREE.IcosahedronGeometry(0.18, 1), P.dome, -1.0, LAND + 0.17, -5.0));

    // radio masts with crossbars and guy wires
    const poles: {m: THREE.Matrix4; c: string}[] = [], bars: {m: THREE.Matrix4; c: string}[] = [], wires: {m: THREE.Matrix4; c: string}[] = [];
    MASTS.forEach((M, mi) => {
      poles.push({m: mat4(M.x, LAND, M.z, 0.026, M.h, 0.026), c: P.mast});
      poles.push({m: mat4(M.x, LAND, M.z, 0.09, 0.03, 0.09), c: P.footing});
      for (const f of [0.55, 0.8]) bars.push({m: mat4(M.x, LAND + M.h * f, M.z, 0.2 * (1.1 - f * 0.5), 0.014, 0.014, mi * 0.8), c: P.bar});
      const top = new THREE.Vector3(M.x, LAND + M.h * 0.92, M.z);
      for (let k = 0; k < 3; k++) {
        const a = mi * 0.7 + k * 2.094;
        const anchor = new THREE.Vector3(M.x + Math.cos(a) * 0.55, LAND, M.z + Math.sin(a) * 0.55);
        const dir = top.clone().sub(anchor);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        wires.push({m: new THREE.Matrix4().compose(anchor, q, new THREE.Vector3(0.007, dir.length(), 0.007)), c: P.wire});
      }
    });
    local.add(instanced(unit, poles), instanced(unit, bars), instanced(unit, wires, false));

    // dock at the shelf edge: deck, piles, bollards, a skiff
    local.add(slab(DOCKX - 0.3, DOCKX + 0.3, EDGE - 2.6, EDGE + 0.7, LAND + 0.02, LAND + 0.05, P.wood));
    for (let i = 0; i < 12; i++) local.add(slab(DOCKX - 0.3, DOCKX + 0.3, EDGE - 2.5 + i * 0.27, EDGE - 2.5 + i * 0.27 + 0.03, LAND + 0.05, LAND + 0.056, P.woodDark));
    const piles: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 5; i++) for (const sx of [-0.27, 0.27]) piles.push({m: mat4(DOCKX + sx, -0.3, EDGE - 2.4 + i * 0.6, 0.04, 0.62, 0.04), c: P.pile});
    for (const sx of [-0.27, 0.27]) piles.push({m: mat4(DOCKX + sx, LAND + 0.05, EDGE - 2.5, 0.05, 0.07, 0.05), c: P.pile});
    local.add(instanced(unit, piles));
    local.add(instanced(chamferBox(1, 1, 1, 0.01), [
      {m: mat4(DOCKX - 0.65, -0.01, EDGE - 1.6, 0.12, 0.05, 0.3, 0.1), c: P.skiff},
      {m: mat4(DOCKX + 0.7, -0.01, EDGE - 2.2, 0.12, 0.05, 0.28, -0.2), c: P.cabin[1]},
    ]));

    // shared scatter filter: keeps decoration off tracks, buildings, the plaza and the lot
    const deco = (x: number, z: number, pad = 0.15) =>
      !inRect(PLAZA, x, z, 0.1) && !roadAt(x, z, 0.02) && !onBld(x, z, 0.08) && !onBase(x, z, 0.1) && !onLot(x, z, 0.1) && !nearHill(x, z, 0.2) && !(Math.abs(x - DOCKX) < 0.6 && z < EDGE + 1.5) && ok(x, z, pad);

    // snow drifts and rocks
    const drifts: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 180; i++) {
      const near = i >= 110;
      const x = near ? THREE.MathUtils.lerp(-2.2, 2.4, rand(seed, `mx${i}`)) : THREE.MathUtils.lerp(-6, 6, rand(seed, `mx${i}`));
      const z = near ? THREE.MathUtils.lerp(3, 11.5, rand(seed, `mz${i}`)) : THREE.MathUtils.lerp(-14, 12, rand(seed, `mz${i}`));
      if (!deco(x, z, 0.2)) continue;
      drifts.push({m: mat4(x, LAND - 0.01, z, 0.18 + rand(seed, `ms${i}`) * 0.22, 0.04 + rand(seed, `mh${i}`) * 0.03, 0.12 + rand(seed, `md${i}`) * 0.13, rand(seed, `mr${i}`) * 3), c: pick(seed, `mc${i}`, P.mound) as string});
    }
    const driftGeo = new THREE.IcosahedronGeometry(1, 0);
    driftGeo.deleteAttribute('uv');
    local.add(instanced(driftGeo, drifts, false));
    const rocks: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 60; i++) {
      const x = THREE.MathUtils.lerp(-7, 7, rand(seed, `rx${i}`)), z = THREE.MathUtils.lerp(-13, 11, rand(seed, `rz${i}`));
      if (!deco(x, z, 0.15)) continue;
      const s = 0.03 + rand(seed, `rs${i}`) * 0.05;
      rocks.push({m: mat4(x, LAND, z, s * 1.3, s * 0.8, s, rand(seed, `rr${i}`) * 3), c: pick(seed, `rc${i}`, P.pebble) as string});
    }
    local.add(instanced(driftGeo, rocks));

    // crates beside cabins, fuel drums by the base, flags along the main track
    const crates: {m: THREE.Matrix4; c: string}[] = [];
    cabins.slice(0, 26).forEach((b, i) => {
      const x = b.x + b.w / 2 + 0.07, z = b.z + (rand(seed, `kz${i}`) - 0.5) * b.d;
      if (!roadAt(x, z, 0) && ok(x, z, 0.1)) crates.push({m: mat4(x, LAND, z, 0.07, 0.06, 0.07, rand(seed, `kr${i}`)), c: pick(seed, `kc${i}`, P.crate) as string});
    });
    local.add(instanced(unit, crates));
    const drumGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.09, 6).toNonIndexed();
    drumGeo.deleteAttribute('uv');
    drumGeo.translate(0, 0.045, 0);
    const drums: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 12; i++) {
      const x = THREE.MathUtils.lerp(0.9, 1.9, rand(seed, `dx${i}`)), z = THREE.MathUtils.lerp(-2.4, -1.2, rand(seed, `dz${i}`));
      if (deco(x, z, 0.1)) drums.push({m: mat4(x, LAND, z), c: pick(seed, `dc${i}`, P.drum) as string});
    }
    local.add(instanced(drumGeo, drums));
    const poleItems: {m: THREE.Matrix4; c: string}[] = [], flagItems: {m: THREE.Matrix4; c: string}[] = [];
    for (let z = -10; z < 11.6; z += 1.1) {
      const x = 0.88;
      if (onLot(x, z, 0.2) || !ok(x, z, 0.15) || CROSS.some((c) => Math.abs(z - c) < 0.2)) continue;
      poleItems.push({m: mat4(x, LAND, z, 0.008, 0.2, 0.008), c: P.flagPole});
      flagItems.push({m: mat4(x + 0.035, LAND + 0.15, z, 0.07, 0.045, 0.006), c: P.flag});
    }
    local.add(instanced(unit, poleItems), instanced(unit, flagItems));

    // tracked vehicles on the tracks
    const cars = ([[0.6, 9.4, Math.PI / 2], [0.6, 1.7, Math.PI / 2], [-1.4, 2.75, 0], [1.7, 8.5, 0], [0.6, -5.2, Math.PI / 2], [-3.5, -6.2, 0]] as [number, number, number][])
      .filter(([x, z]) => ok(x, z, 0.2))
      .map(([x, z, r], i) => ({m: mat4(x, LAND + 0.01, z, 0.85, 0.85, 0.85, r), c: P.vehicle[i % P.vehicle.length] as string}));
    local.add(instanced(carGeometry(), cars));

    // penguin colonies in the foreground
    const body = new THREE.CylinderGeometry(0.022, 0.032, 0.085, 6).toNonIndexed();
    body.deleteAttribute('uv');
    body.translate(0, 0.0425, 0);
    const head = new THREE.IcosahedronGeometry(0.027, 0);
    head.deleteAttribute('uv');
    head.translate(0, 0.1, 0);
    const belly = box(0.034, 0.055, 0.012, 0, 0.012, 0.027);
    const beak = box(0.012, 0.008, 0.016, 0, 0.095, 0.034);
    const clusters: [number, number, number, number][] = [
      [-0.9, 8.3, 11, 0.4], [0.2, 10.2, 9, 0.35], [-0.3, 7.2, 7, 0.3], [1.1, 8.8, 8, 0.3], [1.3, 4.7, 7, 0.35],
      [2.4, 2.0, 7, 0.4], [-3.2, 0.4, 7, 0.4], [-1.6, 9.9, 6, 0.3], [1.4, -16.6, 5, 0.25], [-2.2, 3.0, 5, 0.3],
    ];
    const pens: THREE.Matrix4[] = [];
    clusters.forEach(([cx, cz, n, r], ci) => {
      for (let i = 0; i < n; i++) {
        const a = rand(seed, `pa${ci}:${i}`) * 6.28, d = Math.sqrt(rand(seed, `pd${ci}:${i}`)) * r;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!ok(x, z, 0.1) || onBld(x, z, 0.06) || onLot(x, z, 0.05) || inRect(PLAZA, x, z, 0) || onBase(x, z, 0.05)) continue;
        const s = 0.85 + rand(seed, `ps${ci}:${i}`) * 0.3;
        pens.push(mat4(x, LAND, z, s, s, s, ci * 1.3 + (rand(seed, `pr${ci}:${i}`) - 0.5) * 1.2));
      }
    });
    local.add(inst(body, pens, P.penguin), inst(head, pens, P.penguin), inst(belly, pens, P.belly), inst(beak, pens, P.beak));

    // a few seals
    const sealBody = new THREE.IcosahedronGeometry(1, 1);
    sealBody.scale(0.15, 0.05, 0.07);
    sealBody.translate(0, 0.04, 0);
    sealBody.deleteAttribute('uv');
    const sealHead = new THREE.IcosahedronGeometry(0.036, 0);
    sealHead.translate(0.14, 0.055, 0);
    sealHead.deleteAttribute('uv');
    const sealSpots = ([[-0.55, 9.4, 0.5, 1], [1.05, 7.5, -0.6, 1.1], [-1.55, 6.9, 2.4, 0.9], [0.35, 11.1, 0.1, 1], [2.6, 3.5, 1.0, 1], [-3.0, 2.2, -0.8, 1]] as [number, number, number, number][])
      .filter(([x, z]) => ok(x, z, 0.15) && !onBld(x, z, 0.1) && !onLot(x, z, 0.1));
    const sealItems = sealSpots.map(([x, z, r, s], i) => ({m: mat4(x, LAND, z, s, s, s, r), c: pick(seed, `sl${i}`, P.seal) as string}));
    local.add(instanced(sealBody, sealItems), instanced(sealHead, sealItems));

    // snow-dusted rocky hills: near flanks, a coast and a far range
    const peak = (key: string, x: number, z: number, r: number, h: number, sides: number, rock: string) => {
      local.add(mesh(hill(seed, key, r, h, sides), rock, x, LAND - 0.2, z));
      const f = 0.4;
      const capG = new THREE.ConeGeometry(r * f * 1.12, h * f, sides, 1).toNonIndexed();
      capG.deleteAttribute('uv');
      capG.translate(0, (h * f) / 2, 0);
      local.add(mesh(capG, P.snowcap, x, LAND - 0.2 + h * (1 - f) * 0.985, z));
    };
    NEAR_HILLS.forEach((h, i) => peak(`nh${i}`, h.x, h.z, h.r, h.h, h.s, P.rock));
    for (let i = 0; i < 10; i++) peak(`co${i}`, -50 + i * 10.5 + rand(seed, `cox${i}`) * 4, -135 - rand(seed, `coz${i}`) * 15, 7 + rand(seed, `cor${i}`) * 4, 3 + rand(seed, `coh${i}`) * 3, 5 + Math.floor(rand(seed, `cos${i}`) * 3), P.rock);
    for (let i = 0; i < 9; i++) peak(`fr${i}`, -52 + i * 12.5 + rand(seed, `frx${i}`) * 4, -170 - rand(seed, `frz${i}`) * 18, 8 + rand(seed, `frr${i}`) * 4, 5 + rand(seed, `frh${i}`) * 3.5, 5 + Math.floor(rand(seed, `frs${i}`) * 3), P.rockFar);

    // icebergs floating in the dark sea behind the shelf edge: tabular slabs and a few peaked bergs
    const bergGeo = chamferBox(1, 1, 1, 0.04);
    const bergs: {m: THREE.Matrix4; c: string}[] = [], caps: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 26; i++) {
      const big = i >= 18;
      const x = big ? THREE.MathUtils.lerp(-50, 50, rand(seed, `bx${i}`)) : THREE.MathUtils.lerp(-28, 28, rand(seed, `bx${i}`));
      const z = big ? THREE.MathUtils.lerp(-85, -112, rand(seed, `bz${i}`)) : THREE.MathUtils.lerp(-24, -75, rand(seed, `bz${i}`));
      const w = big ? 5 + rand(seed, `bw${i}`) * 7 : 1.2 + rand(seed, `bw${i}`) * 3.6;
      const d = big ? 3 + rand(seed, `bd${i}`) * 4 : 0.8 + rand(seed, `bd${i}`) * 2.2;
      const h = (big ? 1 : 0.3) + rand(seed, `bh${i}`) * 0.7;
      const r = (rand(seed, `br${i}`) - 0.5) * 0.6;
      bergs.push({m: mat4(x, -0.25, z, w, h, d, r), c: pick(seed, `bc${i}`, P.berg) as string});
      caps.push({m: mat4(x, -0.25 + h, z, w * 0.97, 0.02, d * 0.97, r), c: P.bergCap});
    }
    local.add(instanced(bergGeo, bergs), instanced(unit, caps, false));
    for (let i = 0; i < 9; i++) {
      const g = hill(seed, `berg${i}`, 0.8 + rand(seed, `gr${i}`) * 1.4, 0.8 + rand(seed, `gh${i}`) * 2.0, 5 + Math.floor(rand(seed, `gs${i}`) * 2));
      const m = mesh(g, pick(seed, `gc${i}`, P.berg) as string, THREE.MathUtils.lerp(-30, 30, rand(seed, `gx${i}`)), -0.35, THREE.MathUtils.lerp(-26, -90, rand(seed, `gz${i}`)));
      m.scale.y = 0.75;
      local.add(m);
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
        {x0: NS - 0.15, x1: NS + 0.15, z0: -14, z1: 14},
        {x0: -12, x1: 12, z0: CROSS[0] - 0.15, z1: CROSS[0] + 0.15},
        {x0: -12, x1: 12, z0: CROSS[1] - 0.15, z1: CROSS[1] + 0.15},
        {x0: -12, x1: 12, z0: CROSS[2] - 0.15, z1: CROSS[2] + 0.15},
        FIELD,
      ],
      snow: [{x0: -140, x1: 140, z0: EDGE, z1: 30}, {x0: -200, x1: 200, z0: -200, z1: -120}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -14,
        ok: (w) => {
          const x = w.x, z = w.z + 6;
          return z > EDGE + 0.6 && !onBld(x, z, 0.3) && !onBase(x, z, 0.4) && !MASTS.some((m) => Math.hypot(x - m.x, z - m.z) < 0.4) && !nearHill(x, z, 0.3) && !(Math.abs(x - DOCKX) < 0.6 && z < EDGE + 1.5);
        },
      },
    };
  },
};
