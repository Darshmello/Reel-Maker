// Canal City: terracotta and cream houses packed between narrow canals, arched footbridges, gondolas,
// and a domed basilica (central dome in the accent colour) on a piazza at the lagoon edge.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets the ground near local z 10.7, the
// frame is only ~3 m wide at the plaza and ~7 m wide at the piazza. Canals are painted on the land and
// the sea plane sits just under the ground, so water acts flood the city from below.
import {THREE, blocks, box, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const WATER_Y = LAND - 0.1;
const PLAZA: Rect = {x0: -1.8, x1: 0.2, z0: 3.8, z1: 6.6};
const PIAZZA: Rect = {x0: -4.2, x1: 5.2, z0: -30, z1: -8.7};
const LOT = {x: 1.7, z: 0.6, hx: 0.7, hz: 0.45};
const LOT_R: Rect = {x0: LOT.x - LOT.hx, x1: LOT.x + LOT.hx, z0: LOT.z - LOT.hz, z1: LOT.z + LOT.hz};
const LANE: Rect = {x0: -16, x1: 16, z0: -4.5, z1: -3.8};
const CANALS: Rect[] = [
  {x0: -16, x1: 16, z0: 7.0, z1: 8.1},
  {x0: -16, x1: 16, z0: 1.5, z1: 2.3},
  {x0: -16, x1: 16, z0: -8.3, z1: -7.5},
  {x0: 1.0, x1: 1.7, z0: 2.3, z1: 7.0},
  {x0: -3.4, x1: -2.7, z0: -7.5, z1: 14},
  {x0: 3.2, x1: 3.9, z0: -7.5, z1: 14},
  {x0: -7.5, x1: -6.8, z0: -7.5, z1: 14},
  {x0: 7.0, x1: 7.7, z0: -7.5, z1: 14},
];
const WALK: Rect[] = [
  PLAZA,
  {x0: -3.8, x1: 4.8, z0: -29, z1: -9.2},
  {x0: -2.5, x1: 3.0, z0: 8.12, z1: 8.4},
  {x0: -2.5, x1: 0.9, z0: 2.32, z1: 2.58},
  {x0: -2.5, x1: 3.0, z0: -4.35, z1: -3.95},
  {x0: -2.5, x1: 3.0, z0: -7.45, z1: -7.15},
];
// x, z, spans along z?, length
const BRIDGES: [number, number, boolean, number][] = [
  [-1.2, 7.55, true, 1.65],
  [1.35, 4.65, false, 1.25],
  [-0.4, 1.9, true, 1.35],
  [-0.3, -7.9, true, 1.35],
  [-3.05, 3.2, false, 1.25],
  [3.55, 5.0, false, 1.25],
  [4.8, 7.55, true, 1.65],
  [4.8, 1.9, true, 1.35],
  [-3.05, -2.5, false, 1.25],
  [-5, 1.9, true, 1.35],
];
const BX = 1.3, BZ = -26.6;
const BASILICA: Rect = {x0: BX - 1.9, x1: BX + 1.9, z0: BZ - 1.2, z1: BZ + 1.2};
const CAMP: Rect = {x0: -2.4, x1: -2.0, z0: -22.7, z1: -22.3};

const inside = (x: number, z: number, r: Rect, p: number) => x > r.x0 - p && x < r.x1 + p && z > r.z0 - p && z < r.z1 + p;

export const pack: SetPack = {
  hero: {x: -0.9, z: -1.0, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);
    const unit = chamferBox(1, 1, 1, 0.02);
    const ub = box(1, 1, 1);

    const water = sea(P.sea);
    group.add(water);

    // ground: paved city land, the lagoon behind it, a stone embankment between them
    local.add(slab(-90, 90, -31, 30, -1, LAND, P.ground));
    local.add(slab(-90, 90, -280, -31, -1, WATER_Y, P.lagoon));
    local.add(slab(-90, 90, -31.4, -30, -1, LAND + 0.03, P.quay));
    local.add(slab(-200, 200, -195, -160, -1, LAND, P.mainland));
    for (const c of CANALS) local.add(slab(c.x0, c.x1, c.z0, c.z1, LAND, LAND + 0.006, P.canal));
    local.add(slab(PIAZZA.x0, PIAZZA.x1, PIAZZA.z0, PIAZZA.z1, LAND, LAND + 0.01, P.piazza));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.012, P.campo));
    local.add(slab(LOT_R.x0, LOT_R.x1, LOT_R.z0, LOT_R.z1, LAND, LAND + 0.01, P.campo));
    const stripes: Item[] = [];
    for (let z = -29.4; z < -9.4; z += 1.2) stripes.push({m: mat4((PIAZZA.x0 + PIAZZA.x1) / 2, LAND + 0.01, z, PIAZZA.x1 - PIAZZA.x0 - 0.6, 0.004, 0.4), c: P.paving});
    local.add(instanced(ub, stripes, false));

    // the town: terracotta and cream blocks between the canals, lower toward the camera
    const houseOk = (x: number, z: number) =>
      z < 12.6 && ok(x, z, 0.5) && !CANALS.some((c) => inside(x, z, c, 0.85)) && !inside(x, z, PLAZA, 0.6) && !inside(x, z, PIAZZA, 0.55) && !inside(x, z, LOT_R, 0.55) && !inside(x, z, LANE, 0.6);
    const town = blocks(seed, 'town', {x0: -14, x1: 14, z0: -30, z1: 12.6}, LAND, P.wall, {
      cell: 1.15,
      gap: 0.08,
      hMin: 0.38,
      hMax: 0.85,
      ok: houseOk,
      heightAt: (_x, z) => THREE.MathUtils.clamp(1 - z * 0.06, 0.55, 1.15),
    });
    const records = town.records;
    const buildings = instanced(unit, town.items);
    local.add(buildings);

    // pitched terracotta roofs on most houses, chimneys on a third
    const roofG = new THREE.ConeGeometry(0.7071, 1, 4, 1).toNonIndexed();
    roofG.rotateY(Math.PI / 4);
    roofG.deleteAttribute('uv');
    roofG.translate(0, 0.5, 0);
    const roofs: Item[] = [], chimneys: Item[] = [];
    records.forEach((b, i) => {
      if (rand(seed, `rf${i}`) > 0.25) roofs.push({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.06, 0.1 + rand(seed, `rh${i}`) * 0.14, b.d * 1.06), c: pick(seed, `rc${i}`, P.roof)});
      if (rand(seed, `ch${i}`) < 0.33) chimneys.push({m: mat4(b.x + b.w * 0.25, LAND + b.h, b.z - b.d * 0.2, 0.05, 0.16, 0.05), c: P.chimney});
    });
    if (roofs.length) local.add(instanced(roofG, roofs));
    if (chimneys.length) local.add(instanced(ub, chimneys));

    // everything scattered so far, to keep props from piling up
    const props: {x: number; z: number}[] = [];
    const blocked = (x: number, z: number, pad = 0.1) =>
      !ok(x, z, pad) ||
      z > 12.6 ||
      CANALS.some((c) => inside(x, z, c, pad + 0.05)) ||
      WALK.some((r) => inside(x, z, r, pad)) ||
      inside(x, z, PIAZZA, pad) ||
      inside(x, z, LOT_R, pad) ||
      inside(x, z, LANE, pad) ||
      records.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) ||
      props.some((p) => Math.hypot(p.x - x, p.z - z) < 0.25);
    const treeOk = (x: number, z: number) => {
      if (blocked(x, z, 0.1)) return false;
      props.push({x, z});
      return true;
    };
    local.add(forest(seed, 'garden', [{x0: -13, x1: 13, z0: -29, z1: 12}], 140, LAND, {canopy: P.tree, trunk: P.trunk}, treeOk, 0.9));

    // caffe umbrellas and a well on the plaza, away from the hero
    const poles: Item[] = [], canopies: Item[] = [], tables: Item[] = [], wells: Item[] = [];
    const canopyG = new THREE.ConeGeometry(1, 1, 6, 1).toNonIndexed();
    canopyG.deleteAttribute('uv');
    canopyG.translate(0, 0.5, 0);
    ([[-1.6, 4.2], [-0.3, 4.15], [-0.05, 5.9], [-1.6, 6.0]] as [number, number][]).forEach(([x, z], i) => {
      if (!ok(x, z, 0.3)) return;
      poles.push({m: mat4(x, LAND, z, 0.012, 0.17, 0.012), c: P.woodDark});
      canopies.push({m: mat4(x, LAND + 0.15, z, 0.14, 0.06, 0.14, i), c: pick(seed, `um${i}`, P.umbrella)});
      tables.push({m: mat4(x, LAND + 0.012, z, 0.18, 0.05, 0.1), c: P.wood});
    });
    local.add(instanced(ub, poles), instanced(canopyG, canopies), instanced(ub, tables));
    const wellG = new THREE.CylinderGeometry(0.1, 0.11, 1, 8).toNonIndexed();
    wellG.deleteAttribute('uv');
    wellG.translate(0, 0.5, 0);
    if (ok(-1.0, 4.1, 0.3)) wells.push({m: mat4(-1.0, LAND + 0.01, 4.1, 1, 0.09, 1), c: P.well});

    // the lot: a market campiello unless a server farm will stand there
    if (!server) {
      const stallP: Item[] = [], stallC: Item[] = [], stallT: Item[] = [];
      [LOT.x - 0.35, LOT.x + 0.3].forEach((x, i) => {
        stallP.push({m: mat4(x, LAND + 0.01, LOT.z, 0.012, 0.14, 0.012), c: P.woodDark});
        stallC.push({m: mat4(x, LAND + 0.12, LOT.z, 0.17, 0.06, 0.17, i * 0.7), c: pick(seed, `st${i}`, P.umbrella)});
        stallT.push({m: mat4(x, LAND + 0.01, LOT.z + 0.1, 0.2, 0.05, 0.08), c: pick(seed, `sc${i}`, P.crate)});
      });
      local.add(instanced(ub, stallP), instanced(canopyG, stallC), instanced(ub, stallT));
    }
    if (wells.length) local.add(instanced(wellG, wells));

    // piazza lamps and three flagpoles before the basilica
    const lampP: Item[] = [], lampH: Item[] = [], flagP: Item[] = [], flagC: Item[] = [];
    for (const z of [-12, -15.5, -19, -22.5, -26]) {
      for (const x of [-3.9, 4.9]) {
        lampP.push({m: mat4(x, LAND, z, 0.012, 0.22, 0.012), c: P.lamp});
        lampH.push({m: mat4(x, LAND + 0.2, z, 0.04, 0.04, 0.04), c: P.lampGlow});
        props.push({x, z});
      }
    }
    [-1.2, 0, 1.2].forEach((dx, i) => {
      const x = BX + dx, z = BZ + 1.5;
      flagP.push({m: mat4(x, LAND, z, 0.012, 1.1, 0.012), c: P.pole});
      flagC.push({m: mat4(x + 0.09, LAND + 0.92, z, 0.16, 0.1, 0.01), c: P.flag[i % 3]});
      props.push({x, z});
    });
    local.add(instanced(ub, lampP), instanced(ub, lampH), instanced(ub, flagP), instanced(ub, flagC));

    // arched footbridges over the canals
    const bridge = (x: number, z: number, len: number, alongZ: boolean) => {
      const g = new THREE.Group();
      const W = 0.22, peak = 0.13, end = 0.02, sh = len * 0.18;
      const part = (w: number, h: number, d: number, px: number, py: number, pz: number, rz: number, color: string) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).toNonIndexed(), flat(col(color)));
        m.position.set(px, py, pz);
        m.rotation.z = rz;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      };
      part(2 * sh, 0.035, W, 0, LAND + peak, 0, 0, P.bridge);
      for (const s of [-1, 1]) part(2 * sh, 0.05, 0.02, 0, LAND + peak + 0.04, s * (W / 2 - 0.01), 0, P.parapet);
      const dx = len / 2 - sh, dy = peak - end;
      const L = Math.hypot(dx, dy);
      for (const s of [-1, 1]) {
        const cx = (s * (len / 2 + sh)) / 2, cy = LAND + (peak + end) / 2, rot = -s * Math.atan2(dy, dx);
        part(L, 0.035, W, cx, cy, 0, rot, P.bridge);
        for (const t of [-1, 1]) part(L, 0.05, 0.02, cx, cy + 0.04, t * (W / 2 - 0.01), rot, P.parapet);
      }
      g.position.set(x, 0, z);
      if (alongZ) g.rotation.y = Math.PI / 2;
      local.add(g);
    };
    for (const [x, z, alongZ, len] of BRIDGES) bridge(x, z, len, alongZ);

    // gondolas, sandolos and a water bus on the canals
    const taken: {x: number; z: number}[] = [];
    const hulls: Item[] = [], bits: Item[] = [], tops: Item[] = [];
    const canalBoats = (c: Rect, max: number, key: string) => {
      const alongX = c.x1 - c.x0 > c.z1 - c.z0;
      const cw = alongX ? c.z1 - c.z0 : c.x1 - c.x0;
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      const half = (cw - 0.3) / 2;
      let n = 0;
      for (let i = 0; i < 70 && n < max; i++) {
        const t = rand(seed, `${key}t${i}`), o = (rand(seed, `${key}o${i}`) - 0.5) * 2 * half * 0.6;
        const x = alongX ? THREE.MathUtils.lerp(-5.5, 5.5, t) : cx + o;
        const z = alongX ? cz + o : THREE.MathUtils.lerp(-6, 12, t);
        if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < 0.55) || BRIDGES.some((b) => Math.hypot(b[0] - x, b[1] - z) < 0.5)) continue;
        taken.push({x, z});
        n++;
        const ry = (alongX ? 0 : Math.PI / 2) + (rand(seed, `${key}r${i}`) - 0.5) * 0.1;
        const ux = Math.cos(ry), uz = -Math.sin(ry);
        const u = rand(seed, `${key}k${i}`);
        const y = LAND + 0.004;
        if (cw > 1 && u < 0.12) {
          hulls.push({m: mat4(x, y, z, 0.75, 0.06, 0.2, ry), c: P.cabin});
          bits.push({m: mat4(x, y + 0.06, z, 0.5, 0.09, 0.17, ry), c: P.hull[0]});
          tops.push({m: mat4(x, y + 0.15, z, 0.54, 0.02, 0.2, ry), c: P.busRoof});
        } else if (u < 0.62) {
          const c1 = pick(seed, `${key}g${i}`, P.gondola);
          hulls.push({m: mat4(x, y, z, 0.4, 0.04, 0.07, ry), c: c1});
          for (const s of [-1, 1]) bits.push({m: mat4(x + ux * 0.2 * s, y + 0.02, z + uz * 0.2 * s, 0.025, 0.07, 0.03, ry), c: c1});
          bits.push({m: mat4(x - ux * 0.08, y + 0.04, z - uz * 0.08, 0.03, 0.08, 0.03), c: pick(seed, `${key}p${i}`, P.rider)});
        } else {
          hulls.push({m: mat4(x, y, z, 0.3, 0.045, 0.1, ry), c: pick(seed, `${key}h${i}`, P.hull)});
          bits.push({m: mat4(x + ux * 0.05, y + 0.045, z + uz * 0.05, 0.08, 0.04, 0.07, ry), c: P.cabin});
        }
      }
    };
    canalBoats(CANALS[0], 16, 'bf');
    canalBoats(CANALS[1], 12, 'bb');
    canalBoats(CANALS[2], 8, 'bm');
    canalBoats(CANALS[3], 5, 'v1');
    canalBoats(CANALS[4], 8, 'v2');
    canalBoats(CANALS[5], 7, 'v3');
    canalBoats(CANALS[6], 4, 'v4');
    canalBoats(CANALS[7], 4, 'v5');
    local.add(instanced(ub, hulls), instanced(ub, bits), instanced(ub, tops));

    // the basilica: five domes, the central one in the accent colour
    const solid = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(g, flat(col(color)));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      local.add(m);
    };
    const cyl = (rt: number, rb: number, h: number, sides: number) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, sides).toNonIndexed();
      g.deleteAttribute('uv');
      g.translate(0, h / 2, 0);
      return g;
    };
    const dome = (r: number, sy: number) => {
      const g = new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
      g.deleteAttribute('uv');
      g.scale(1, sy, 1);
      return g;
    };
    const spire = (r: number, h: number, sides: number) => {
      const g = new THREE.ConeGeometry(r, h, sides, 1).toNonIndexed();
      g.deleteAttribute('uv');
      g.translate(0, h / 2, 0);
      return g;
    };
    solid(box(3.7, 0.12, 2.3), P.trim, BX, LAND, BZ);
    solid(box(3.4, 1.2, 2.0), P.basilica, BX, LAND + 0.12, BZ);
    for (let i = 0; i < 5; i++) {
      const px = BX - 1.36 + i * 0.68, tall = i === 2;
      solid(box(0.34, tall ? 0.7 : 0.5, 0.04), P.portal, px, LAND + 0.12, BZ + 1.0);
      solid(spire(tall ? 0.2 : 0.15, tall ? 0.45 : 0.32, 4), P.trim, px, LAND + 1.32, BZ + 0.95);
    }
    solid(cyl(0.55, 0.55, 0.3, 8), P.basilica, BX, LAND + 1.32, BZ);
    solid(dome(0.62, 1.05), accent, BX, LAND + 1.62, BZ);
    solid(cyl(0.07, 0.09, 0.25, 6), P.basilica, BX, LAND + 1.62 + 0.62 * 1.05, BZ);
    solid(spire(0.09, 0.2, 6), accent, BX, LAND + 1.62 + 0.62 * 1.05 + 0.25, BZ);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        solid(cyl(0.28, 0.28, 0.18, 6), P.basilica, BX + sx * 1.1, LAND + 1.32, BZ + sz * 0.5);
        solid(dome(0.32, 1.0), P.domeSmall, BX + sx * 1.1, LAND + 1.5, BZ + sz * 0.5);
      }
    }
    // campanile beside the piazza
    solid(box(0.4, 2.4, 0.4), P.campanile, -2.2, LAND, -22.5);
    solid(box(0.5, 0.32, 0.5), P.belfry, -2.2, LAND + 2.4, -22.5);
    const campRoof = new THREE.ConeGeometry(0.4, 0.6, 4, 1).toNonIndexed();
    campRoof.rotateY(Math.PI / 4);
    campRoof.deleteAttribute('uv');
    campRoof.translate(0, 0.3, 0);
    solid(campRoof, P.campRoof, -2.2, LAND + 2.72, -22.5);

    // lagoon: mooring posts, sailboats, low islands with cypresses
    const posts: Item[] = [];
    const postG = new THREE.CylinderGeometry(0.025, 0.025, 1, 5).toNonIndexed();
    postG.deleteAttribute('uv');
    postG.translate(0, 0.5, 0);
    for (let i = 0; i < 22; i++) {
      const px = THREE.MathUtils.lerp(-9, 9, rand(seed, `pk${i}`)), pz = -33.5 - rand(seed, `pz${i}`) * 38;
      for (let k = 0; k < 3; k++) posts.push({m: mat4(px + k * 0.13, WATER_Y - 0.05, pz + (k % 2) * 0.06, 1, 0.4, 1), c: P.pole});
    }
    local.add(instanced(postG, posts, false));
    const lag: {x: number; z: number}[] = [];
    const lhull: Item[] = [], lsail: Item[] = [];
    const sailG = new THREE.ConeGeometry(0.2, 1, 3, 1).toNonIndexed();
    sailG.deleteAttribute('uv');
    sailG.scale(1, 1, 0.12);
    sailG.translate(0, 0.5, 0);
    for (let i = 0; i < 50 && lag.length < 12; i++) {
      const x = THREE.MathUtils.lerp(-8, 8, rand(seed, `lx${i}`)), z = THREE.MathUtils.lerp(-34, -62, rand(seed, `lz${i}`));
      if (lag.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2)) continue;
      lag.push({x, z});
      const ry = (rand(seed, `lr${i}`) - 0.5) * 1.2;
      lhull.push({m: mat4(x, WATER_Y - 0.02, z, 0.45, 0.07, 0.16, ry), c: pick(seed, `lh${i}`, P.hull)});
      lsail.push({m: mat4(x, WATER_Y + 0.05, z, 1, 0.7, 1, ry), c: pick(seed, `ls${i}`, P.sail)});
    }
    local.add(instanced(ub, lhull), instanced(sailG, lsail));

    const isl: Item[] = [], islRoof: Item[] = [], cyp: Item[] = [];
    const cypG = new THREE.ConeGeometry(0.1, 1, 5, 1).toNonIndexed();
    cypG.deleteAttribute('uv');
    cypG.translate(0, 0.5, 0);
    const island = (x: number, z: number, r: number, key: string, tower: boolean) => {
      const g = new THREE.CylinderGeometry(r, r * 1.08, 0.3, 9).toNonIndexed();
      g.deleteAttribute('uv');
      const m = new THREE.Mesh(g, flat(col(P.island)));
      m.position.set(x, WATER_Y - 0.1, z);
      m.receiveShadow = true;
      local.add(m);
      const base = WATER_Y + 0.05;
      for (let i = 0; i < 9; i++) {
        const a = rand(seed, `${key}a${i}`) * 6.28, d = Math.sqrt(rand(seed, `${key}d${i}`)) * r * 0.7;
        const hx = x + Math.cos(a) * d, hz = z + Math.sin(a) * d;
        const w = 0.9 + rand(seed, `${key}w${i}`) * 0.5, h = 0.6 + rand(seed, `${key}h${i}`) * 0.6;
        isl.push({m: mat4(hx, base, hz, w, h, w), c: pick(seed, `${key}c${i}`, P.wall)});
        islRoof.push({m: mat4(hx, base + h, hz, w * 1.06, 0.25, w * 1.06), c: pick(seed, `${key}r${i}`, P.roof)});
      }
      for (let i = 0; i < 7; i++) {
        const a = rand(seed, `${key}ca${i}`) * 6.28;
        cyp.push({m: mat4(x + Math.cos(a) * r * 0.85, base, z + Math.sin(a) * r * 0.85, 1.2, 1.2 + rand(seed, `${key}ch${i}`) * 0.5, 1.2), c: P.cypress});
      }
      if (tower) {
        isl.push({m: mat4(x, base, z, 0.7, 3.2, 0.7), c: P.campanile});
        islRoof.push({m: mat4(x, base + 3.2, z, 0.8, 0.9, 0.8), c: P.campRoof});
      }
    };
    island(-10, -50, 6, 'i1', true);
    island(13, -72, 8, 'i2', false);
    island(-30, -98, 10, 'i3', false);
    local.add(instanced(unit, isl), instanced(roofG, islRoof), instanced(cypG, cyp));

    // hazy far layer: the mainland shore, then mountains
    const farItems: Item[] = [];
    for (let i = 0; i < 140; i++) {
      const w = 2.5 + rand(seed, `fw${i}`) * 3, d = 2.5 + rand(seed, `fd${i}`) * 3;
      const h = i < 6 ? 7 + rand(seed, `fh${i}`) * 3 : 1.5 + rand(seed, `fh${i}`) * 3.5;
      farItems.push({m: mat4(THREE.MathUtils.lerp(-120, 120, rand(seed, `fx${i}`)), LAND, -170 - rand(seed, `fz${i}`) * 20, i < 6 ? 1.4 : w, h, i < 6 ? 1.4 : d), c: pick(seed, `fc${i}`, P.farWall)});
    }
    local.add(instanced(unit, farItems, false));
    const hills = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(hill(seed, `mt${i}`, 26 + rand(seed, `mr${i}`) * 14, 14 + rand(seed, `mh${i}`) * 14, 7), flat(col(i % 2 ? P.hillFar : P.hillHaze)));
      m.position.set(THREE.MathUtils.lerp(-170, 170, i / 8) + rand(seed, `mx${i}`) * 10, LAND - 0.2, -205 - rand(seed, `mz${i}`) * 30);
      hills.add(m);
    }
    local.add(hills);

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records,
      walk: WALK,
      snow: [{x0: -90, x1: 90, z0: -31, z1: 30}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -16,
        ok: (w) => {
          const x = w.x, z = w.z + 6;
          if (!inside(x, z, PIAZZA, -0.4)) return false;
          if (inside(x, z, BASILICA, 0.35) || inside(x, z, CAMP, 0.4)) return false;
          return !props.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3);
        },
      },
    };
  },
};
