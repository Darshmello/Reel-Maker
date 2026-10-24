// Tropical Island: a white sand beach and turquoise shallows in front, beach huts, umbrellas and a low
// hotel strip behind, palm groves, and a green volcano in the haze. The accent colour is the wooden pier.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets the ground near local z 10.7, the
// centre near local z 1; the frame is only ~3 m wide at the beach and ~2 m wide in the shallows.
import {THREE, blocks, box, carGeometry, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const PLAZA: Rect = {x0: -2.0, x1: 0.1, z0: 3.9, z1: 6.4};
const LOT = {x: 1.0, z: 0.6, hx: 0.7, hz: 0.45};
const LOT_R: Rect = {x0: LOT.x - LOT.hx, x1: LOT.x + LOT.hx, z0: LOT.z - LOT.hz, z1: LOT.z + LOT.hz};
const PIER: Rect = {x0: 0.27, x1: 0.63, z0: 6.6, z1: 9.5};
const ROAD2: Rect = {x0: -3.65, x1: -3.35, z0: -90, z1: -3.95};
const KEEP: Rect[] = [
  PLAZA,
  {x0: -0.2, x1: 1.0, z0: 6.4, z1: 9.8},
  LOT_R,
  {x0: -2.6, x1: -0.5, z0: -1.25, z1: -0.05},
  {x0: -14, x1: 14, z0: 1.6, z1: 2.0},
  {x0: -0.75, x1: -0.45, z0: 2.0, z1: 3.9},
  {x0: 0.3, x1: 0.6, z0: 2.0, z1: 6.6},
  {x0: -14, x1: 14, z0: -4.3, z1: -3.95},
  ROAD2,
  {x0: -70, x1: 70, z0: 7.7, z1: 60},
];

const inside = (x: number, z: number, r: Rect, p: number) => x > r.x0 - p && x < r.x1 + p && z > r.z0 - p && z < r.z1 + p;

export const pack: SetPack = {
  hero: {x: -1.0, z: -1.0, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);
    const unit = chamferBox(1, 1, 1, 0.02);
    const ub = box(1, 1, 1);

    // the sea sits just under the shallows: water acts flood the island from below
    const water = sea(P.sea);
    group.add(water);

    // ground: grass island, white beach, wet sand, turquoise shallows with a foam line
    local.add(slab(-90, 90, -200, 3.4, -1, LAND, P.grass));
    local.add(slab(-70, 70, 3.2, 8.4, -1, LAND + 0.01, P.sand));
    local.add(slab(-70, 70, 7.7, 8.4, LAND, LAND + 0.014, P.wet));
    local.add(slab(-70, 70, 8.0, 60, -1, LAND - 0.1, P.shallow));
    local.add(slab(-70, 70, 8.4, 9.8, -1, LAND - 0.09, P.shallowLight));
    local.add(slab(-70, 70, 8.4, 8.55, -1, LAND - 0.075, P.foam));
    local.add(slab(-9, 9, -1.4, 3.3, LAND, LAND + 0.006, P.lawn));
    local.add(slab(-14, 14, 1.6, 2.0, LAND, LAND + 0.014, P.path)); // promenade
    local.add(slab(-0.75, -0.45, 2.0, 3.9, LAND, LAND + 0.02, P.path));
    local.add(slab(0.3, 0.6, 2.0, 6.6, LAND, LAND + 0.02, P.path)); // walk to the pier
    local.add(slab(-14, 14, -4.3, -3.95, LAND, LAND + 0.014, P.road)); // service road behind the hotels
    local.add(slab(ROAD2.x0, ROAD2.x1, ROAD2.z0, ROAD2.z1, LAND, LAND + 0.014, P.road));

    // hotel pool
    local.add(slab(-2.6, -0.5, -1.25, -0.05, LAND, LAND + 0.012, P.deck));
    local.add(slab(-2.4, -0.8, -1.05, -0.3, LAND, LAND + 0.02, P.pool));
    const chairs: Item[] = [-2.2, -1.8, -1.4, -1.0].map((x) => ({m: mat4(x, LAND + 0.012, -0.17, 0.2, 0.03, 0.07), c: P.lounger}));
    local.add(instanced(ub, chairs));

    // the lot: empty for a server farm, otherwise a small clay court
    if (!server) {
      local.add(slab(LOT_R.x0, LOT_R.x1, LOT_R.z0, LOT_R.z1, LAND, LAND + 0.014, P.court));
      local.add(slab(LOT.x - 0.01, LOT.x + 0.01, LOT.z - 0.3, LOT.z + 0.3, LAND + 0.014, LAND + 0.07, P.white));
    }

    // low hotel wings behind the lawn and bungalows either side of the lot
    const offLot = (x: number, z: number) => !inside(x, z, LOT_R, 0.6);
    const hotel = blocks(seed, 'hotel', {x0: -9, x1: 9, z0: -3.6, z1: -1.2}, LAND, P.hotel, {cell: 1.1, gap: 0.15, hMin: 0.3, hMax: 0.75, ok: (x, z) => ok(x, z, 0.4) && offLot(x, z)});
    const bungL = blocks(seed, 'bungl', {x0: -6.5, x1: -0.5, z0: 0, z1: 1.2}, LAND, P.bungalow, {cell: 1.2, gap: 0.25, hMin: 0.18, hMax: 0.32, ok: (x, z) => ok(x, z, 0.4) && offLot(x, z)});
    const bungR = blocks(seed, 'bungr', {x0: 2.4, x1: 6.5, z0: 0, z1: 1.2}, LAND, P.bungalow, {cell: 1.2, gap: 0.25, hMin: 0.18, hMax: 0.32, ok: (x, z) => ok(x, z, 0.4) && offLot(x, z)});
    const items = [...hotel.items, ...bungL.items, ...bungR.items];
    const records = [...hotel.records, ...bungL.records, ...bungR.records];
    const buildings = instanced(unit, items);
    local.add(buildings);
    const lips = records.filter((_, i) => i % 3 === 0).map((b) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 0.9, 0.04, b.d * 0.9), c: P.trim}));
    if (lips.length) local.add(instanced(unit, lips));

    // everything placed so far (huts, umbrellas, palms), to keep props from piling up
    const props: {x: number; z: number}[] = [];
    const blocked = (x: number, z: number, pad = 0.15, gap = 0) =>
      !ok(x, z, pad) ||
      KEEP.some((r) => inside(x, z, r, pad)) ||
      records.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) ||
      props.some((p) => Math.hypot(p.x - x, p.z - z) < gap);

    // beach huts along the back of the sand
    const roofG = new THREE.ConeGeometry(0.75, 1, 4, 1).toNonIndexed();
    roofG.rotateY(Math.PI / 4);
    roofG.deleteAttribute('uv');
    roofG.translate(0, 0.5, 0);
    const hutBody: Item[] = [], hutRoof: Item[] = [];
    for (let i = 0; i < 30; i++) {
      const x = -8 + i * 0.55 + (rand(seed, `hx${i}`) - 0.5) * 0.2;
      const z = 3.3 + rand(seed, `hz${i}`) * 0.12;
      if (rand(seed, `hg${i}`) < 0.2 || blocked(x, z, 0.1, 0.35)) continue;
      const ry = (rand(seed, `hr${i}`) - 0.5) * 0.3;
      hutBody.push({m: mat4(x, LAND, z, 0.26, 0.2, 0.24, ry), c: pick(seed, `hc${i}`, P.hut)});
      hutRoof.push({m: mat4(x, LAND + 0.2, z, 0.3, 0.13, 0.3, ry), c: pick(seed, `hk${i}`, P.thatch)});
      props.push({x, z});
    }
    local.add(instanced(unit, hutBody), instanced(roofG, hutRoof));

    // palms: a slim leaning trunk and a flattened crown
    const trunkG = new THREE.CylinderGeometry(0.014, 0.024, 1, 5).toNonIndexed();
    trunkG.deleteAttribute('uv');
    trunkG.translate(0, 0.5, 0);
    const crownG = new THREE.IcosahedronGeometry(1, 0);
    crownG.deleteAttribute('uv');
    const trunks: Item[] = [], crowns: Item[] = [];
    const palm = (x: number, z: number, k: string, size = 1) => {
      const h = (0.34 + rand(seed, `ph${k}`) * 0.2) * size;
      const lean = (rand(seed, `pl${k}`) - 0.5) * 0.35;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(seed, `py${k}`) * 6.28, lean));
      const base = new THREE.Vector3(x, LAND, z);
      trunks.push({m: new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, h, 1)), c: P.trunk});
      const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(base);
      const r = (0.17 + rand(seed, `pr${k}`) * 0.06) * size;
      crowns.push({m: mat4(top.x, top.y - 0.01, top.z, r, r * 0.4, r, rand(seed, `pc${k}`) * 6.28), c: pick(seed, `pk${k}`, P.palm)});
      props.push({x, z});
    };

    // umbrellas with loungers, towels and a few palms on the sand
    const canopyG = new THREE.ConeGeometry(1, 1, 6, 1).toNonIndexed();
    canopyG.deleteAttribute('uv');
    canopyG.translate(0, 0.5, 0);
    const poles: Item[] = [], canopies: Item[] = [], loungers: Item[] = [], towels: Item[] = [];
    for (let i = 0; i < 80; i++) {
      const x = THREE.MathUtils.lerp(-2.8, 2.8, rand(seed, `bx${i}`));
      const z = THREE.MathUtils.lerp(3.7, 7.5, rand(seed, `bz${i}`));
      if (blocked(x, z, 0.12, 0.34)) continue;
      const kind = pick(seed, `bk${i}`, ['umb', 'palm', 'towel'] as const, [6, 2, 2]);
      const ry = (rand(seed, `br${i}`) - 0.5) * 0.8;
      if (kind === 'palm') {
        palm(x, z, `b${i}`);
        continue;
      }
      if (kind === 'umb') {
        poles.push({m: mat4(x, LAND, z, 0.012, 0.19, 0.012), c: P.post});
        canopies.push({m: mat4(x, LAND + 0.17, z, 0.15, 0.07, 0.15, ry), c: pick(seed, `bc${i}`, P.umbrella)});
        loungers.push({m: mat4(x + 0.1, LAND + 0.01, z + 0.05, 0.08, 0.03, 0.2, ry), c: P.lounger});
      } else {
        towels.push({m: mat4(x, LAND + 0.01, z, 0.1, 0.008, 0.2, ry), c: pick(seed, `bt${i}`, P.towel)});
      }
      props.push({x, z});
    }
    local.add(instanced(ub, poles), instanced(canopyG, canopies), instanced(ub, loungers), instanced(ub, towels));

    // palm groves: lawn, behind the hotels, and farther back
    const grove = (key: string, R: Rect, n: number, size: number) => {
      for (let i = 0; i < n; i++) {
        const x = THREE.MathUtils.lerp(R.x0, R.x1, rand(seed, `${key}x${i}`));
        const z = THREE.MathUtils.lerp(R.z0, R.z1, rand(seed, `${key}z${i}`));
        if (blocked(x, z, 0.15, 0.3)) continue;
        palm(x, z, `${key}${i}`, size);
      }
    };
    grove('pc', {x0: -6, x1: 6, z0: -1.3, z1: 3.2}, 30, 1);
    grove('pa', {x0: -6, x1: 6, z0: -14, z1: -4.4}, 50, 1);
    grove('pb', {x0: -12, x1: 12, z0: -40, z1: -14}, 70, 1.3);
    local.add(instanced(trunkG, trunks), instanced(crownG, crowns));
    local.add(forest(seed, 'jungle', [{x0: -16, x1: 16, z0: -75, z1: -30}], 110, LAND, {canopy: P.tree, trunk: P.trunk}, (x, z) => !blocked(x, z, 0.1), 2.2));

    // the pier, in the accent colour: deck, T-head, rails, posts and a little shelter
    local.add(slab(PIER.x0, PIER.x1, PIER.z0, PIER.z1, LAND + 0.09, LAND + 0.13, accent));
    local.add(slab(-0.1, 0.95, 9.2, 9.6, LAND + 0.09, LAND + 0.13, accent));
    local.add(slab(PIER.x0, PIER.x0 + 0.02, PIER.z0, 9.2, LAND + 0.13, LAND + 0.15, P.post));
    local.add(slab(PIER.x1 - 0.02, PIER.x1, PIER.z0, 9.2, LAND + 0.13, LAND + 0.15, P.post));
    const posts: Item[] = [];
    for (let z = 6.9; z < 9.2; z += 0.45) {
      for (const x of [PIER.x0 + 0.02, PIER.x1 - 0.02]) posts.push({m: mat4(x, LAND - 0.24, z, 0.04, 0.41, 0.04), c: P.post});
    }
    for (const [x, z] of [[-0.07, 9.23], [0.92, 9.23], [-0.07, 9.57], [0.92, 9.57]]) posts.push({m: mat4(x, LAND - 0.24, z, 0.04, 0.41, 0.04), c: P.post});
    for (const [x, z] of [[0.25, 9.28], [0.65, 9.28], [0.25, 9.52], [0.65, 9.52]]) posts.push({m: mat4(x, LAND + 0.13, z, 0.025, 0.22, 0.025), c: P.post});
    local.add(instanced(ub, posts));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.14, 4, 1).toNonIndexed().rotateY(Math.PI / 4), flat(col(accent)));
    roof.position.set(0.45, LAND + 0.35 + 0.07, 9.4);
    roof.castShadow = roof.receiveShadow = true;
    local.add(roof);

    // boats and reef patches in the shallows
    const boats: [number, number, number][] = [[-0.65, 9.0, 0.3], [-0.35, 10.1, -0.3], [0.45, 10.3, 0.05], [0.9, 8.9, 0.9], [-0.9, 10.3, 0.2]];
    const hulls: Item[] = [], sails: Item[] = [];
    boats.forEach(([x, z, ry], i) => {
      hulls.push({m: mat4(x, LAND - 0.11, z, 0.3, 0.05, 0.1, ry), c: pick(seed, `bo${i}`, P.boat)});
      if (i % 2 === 0) sails.push({m: mat4(x, LAND - 0.06, z, 0.12, 0.18, 0.006, ry), c: P.white});
    });
    local.add(instanced(unit, hulls), instanced(ub, sails));
    const reefG = new THREE.CylinderGeometry(1, 1, 0.01, 7).toNonIndexed();
    reefG.deleteAttribute('uv');
    const reefs: Item[] = ([[-0.3, 8.9, 0.3], [0.9, 9.9, 0.4], [-0.9, 10.2, 0.28], [0.1, 10.6, 0.35], [1.0, 8.6, 0.22]] as [number, number, number][]).map(([x, z, r]) => ({m: mat4(x, 0.218, z, r, 1, r), c: P.reef}));
    local.add(instanced(reefG, reefs, false));

    // a few small cars on the promenade and the service road
    const carList: [number, number, number][] = [[-1.6, 1.8, 0], [1.9, 1.8, Math.PI], [-1.0, -4.12, 0], [1.8, -4.12, Math.PI], [3.1, -4.12, 0]];
    const cars: Item[] = carList.map(([x, z, ry], i) => ({m: mat4(x, LAND + 0.014, z, 0.7, 0.7, 0.7, ry), c: pick(seed, `car${i}`, P.car)}));
    local.add(instanced(carGeometry(), cars));

    // hazy far layer: low green hills, a distant ridge, and the volcano
    const hills = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(hill(seed, `h${i}`, 7 + rand(seed, `hr${i}`) * 5, 1.6 + rand(seed, `hh${i}`) * 1.8, 6), flat(col(pick(seed, `hc${i}`, [P.hillNear, P.hillFar]))));
      m.position.set(-60 + i * 9 + rand(seed, `hx${i}`) * 5, LAND - 0.2, -64 - rand(seed, `hz${i}`) * 40);
      m.receiveShadow = true;
      hills.add(m);
    }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(hill(seed, `rg${i}`, 16, 3.6 + rand(seed, `rh${i}`) * 0.8, 7), flat(col(P.hillFar)));
      m.position.set(-50 + i * 20, LAND - 0.2, -150);
      hills.add(m);
    }
    const volcano = new THREE.Mesh(hill(seed, 'volc', 10, 5.6, 8), flat(col(P.volcano)));
    volcano.position.set(4, LAND - 0.2, -88);
    volcano.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 0.35, 8).toNonIndexed(), flat(col(P.crater)));
    cap.position.set(4, LAND - 0.2 + 5.6 - 0.17, -88);
    hills.add(volcano, cap);
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
        {x0: -8, x1: 8, z0: 7.0, z1: 7.7},
        {x0: -12, x1: 12, z0: 1.62, z1: 1.98},
        {x0: 0.3, x1: 0.6, z0: 2.0, z1: 6.6},
        {x0: PIER.x0 + 0.03, x1: PIER.x1 - 0.03, z0: 6.7, z1: 9.4, y: LAND + 0.13},
        {x0: -12, x1: 12, z0: -4.25, z1: -4.0},
      ],
      snow: [{x0: -90, x1: 90, z0: -200, z1: 8.4}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -16,
        ok: (w) => {
          const x = w.x, z = w.z + 6;
          return !records.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.25 && Math.abs(z - b.z) < b.d / 2 + 0.25) && !props.some((p) => Math.hypot(p.x - x, p.z - z) < 0.4) && !inside(x, z, ROAD2, 0.4);
        },
      },
    };
  },
};
