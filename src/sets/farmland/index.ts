// Farmland: a patchwork of crop fields and hedgerows rolling back from a small village crossroads,
// a big barn in the accent colour with grain silos, and a row of wind turbines on low hills.
// Frame (yaw 0): local z = world z + 6. The lower frame edge meets ground near local z 10.7 where the
// frame is only ~1.7 m wide, so field cells shrink toward the camera and fill the bottom of the shot.
import {THREE, blocks, box, carGeometry, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Building, Rect, SetPack} from '../kit';
import {P} from './palette';

const LAND = 0.3;
const PLAZA: Rect = {x0: -1.9, x1: -0.3, z0: 3.6, z1: 6.2};
const VILLAGE: Rect = {x0: -2.4, x1: 3.2, z0: 2.95, z1: 7.2};
const YARD: Rect = {x0: -2.3, x1: -0.2, z0: -3.6, z1: -1.6};
const LOT = {x: 1.3, z: 0.6, hx: 0.6, hz: 0.45};
const LOT_BOX: Rect = {x0: LOT.x - LOT.hx - 0.2, x1: LOT.x + LOT.hx + 0.2, z0: LOT.z - LOT.hz - 0.2, z1: LOT.z + LOT.hz + 0.2};
const POND = {x: 1.9, z: -5.2, r: 0.55};
const BARN = {x: -1.4, z: -2.6};
const SILOS = [{x: -0.55, z: -2.1, r: 0.16, h: 0.8}, {x: -0.55, z: -2.75, r: 0.16, h: 0.65}, {x: -0.55, z: -3.35, r: 0.13, h: 0.5}];
const XST = 2.6;
// field rows, front to back (z1 > z0); the band 2.25..2.95 is the cross street
const ROWS: [number, number][] = [[9.4, 12.2], [7.2, 9.4], [2.95, 7.2], [-1, 2.25], [-3.9, -1], [-7, -3.9], [-10.5, -7], [-14.5, -10.5], [-19.5, -14.5], [-26, -19.5], [-34, -26], [-46, -34]];

const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
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

    // the sea sits just under the meadow: water acts flood the farmland from below
    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-70, 70, -280, 30, -1, LAND, P.grass));

    // roads, village green, farmyard
    local.add(slab(-0.2, 0.2, -40, 14, LAND, LAND + 0.016, P.road));
    local.add(slab(-12, 12, XST - 0.18, XST + 0.18, LAND, LAND + 0.016, P.road));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.014, P.lawn));
    local.add(slab(YARD.x0, YARD.x1, YARD.z0, YARD.z1, LAND, LAND + 0.012, P.yard));

    // farm pond with a sandy rim
    local.add(mesh(new THREE.CylinderGeometry(POND.r + 0.06, POND.r + 0.06, 0.016, 9).toNonIndexed(), P.shore, POND.x, LAND + 0.003, POND.z));
    local.add(mesh(new THREE.CylinderGeometry(POND.r, POND.r, 0.02, 9).toNonIndexed(), P.pond, POND.x, LAND + 0.008, POND.z));

    // the patchwork: rows of fields either side of the main road, shrinking toward the camera
    const blocked: Rect[] = [VILLAGE, YARD, {x0: POND.x - POND.r - 0.15, x1: POND.x + POND.r + 0.15, z0: POND.z - POND.r - 0.15, z1: POND.z + POND.r + 0.15}];
    if (server) blocked.push(LOT_BOX);
    const fieldItems: {m: THREE.Matrix4; c: string}[] = [];
    const furrowItems: {m: THREE.Matrix4; c: string}[] = [];
    const hedgeItems: {m: THREE.Matrix4; c: string}[] = [];
    const baleItems: {m: THREE.Matrix4; c: string}[] = [];
    const farmItems: {m: THREE.Matrix4; c: string}[] = [];
    const farmRecords: Building[] = [];
    const cells: (Rect & {ri: number})[] = [];
    const t = 0.012;
    ROWS.forEach(([z0, z1], ri) => {
      const zc = (z0 + z1) / 2;
      const dist = 18 - zc;
      const base = THREE.MathUtils.clamp(dist * 0.11, 0.9, 4.5);
      const extent = dist * 0.35 + 2.5;
      const hh = 0.05 + dist * 0.0012;
      const hw = 0.05 + dist * 0.002;
      for (const s of [-1, 1]) {
        let edge = s * 0.25;
        let i = 0;
        while (Math.abs(edge) < extent) {
          const key = `f${ri}:${s}:${i++}`;
          const w = base * (0.7 + rand(seed, `${key}w`) * 0.7);
          const xa = edge;
          const xb = edge + s * w;
          edge = xb;
          const R: Rect = {x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0, z1};
          if (blocked.some((b) => hit(R, b))) continue;
          const xc = (R.x0 + R.x1) / 2;
          const cw = R.x1 - R.x0;
          const cd = z1 - z0;
          cells.push({...R, ri});
          fieldItems.push({m: mat4(xc, LAND, zc, cw, t, cd), c: pick(seed, `${key}c`, P.field)});
          // hedgerows on the back and outer edges
          if (rand(seed, `${key}hb`) > 0.15) hedgeItems.push({m: mat4(xc, LAND, z0, cw + hw, hh, hw), c: pick(seed, `${key}hc`, P.hedge)});
          if (rand(seed, `${key}hs`) > 0.15) hedgeItems.push({m: mat4(s > 0 ? R.x1 : R.x0, LAND, zc, hw, hh, cd), c: pick(seed, `${key}hd`, P.hedge)});
          // furrow stripes, along x or along z
          const alongX = rand(seed, `${key}o`) < 0.5;
          const sp = 0.2 + dist * 0.01;
          const n = Math.min(6, Math.max(2, Math.round((alongX ? cd : cw) / sp)));
          const fc = pick(seed, `${key}f`, P.furrow);
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) / n;
            if (alongX) furrowItems.push({m: mat4(xc, LAND + t, z0 + u * cd, cw * 0.94, 0.006, (cd / n) * 0.4), c: fc});
            else furrowItems.push({m: mat4(R.x0 + u * cw, LAND + t, zc, (cw / n) * 0.4, 0.006, cd * 0.94), c: fc});
          }
          // round hay bales on the nearer fields
          if (dist < 36 && baleItems.length < 40 && rand(seed, `${key}b`) < 0.3) {
            const sc = 1 + dist * 0.02;
            baleItems.push({m: mat4(xc, LAND + t + 0.04 * sc, zc, sc, sc, sc, rand(seed, `${key}br`) * 6.28), c: P.bale});
          }
          // a small farmstead tucked against the back hedge
          if (ri !== 2 && ri <= 5 && rand(seed, `${key}h`) < 0.3) {
            const fw = 0.26 + rand(seed, `${key}fw`) * 0.12;
            const fd = 0.22 + rand(seed, `${key}fd`) * 0.1;
            const fh = 0.14 + rand(seed, `${key}fh`) * 0.1;
            const fx = xc + (rand(seed, `${key}fx`) - 0.5) * Math.max(0, cw - fw - 0.1);
            const fz = z0 + 0.18 + fd / 2;
            if (ok(fx, fz, 0.2)) {
              farmItems.push({m: mat4(fx, LAND, fz, fw, fh, fd), c: pick(seed, `${key}fcol`, P.wall)});
              farmRecords.push({x: fx, z: fz, w: fw, h: fh, d: fd, far: false});
            }
          }
        }
      }
    });
    local.add(instanced(box(1, 1, 1), fieldItems, false));
    local.add(instanced(box(1, 1, 1), furrowItems, false));
    local.add(instanced(box(1, 1, 1), hedgeItems));
    const baleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.07, 7).toNonIndexed();
    baleGeo.rotateZ(Math.PI / 2);
    baleGeo.deleteAttribute('uv');
    if (baleItems.length) local.add(instanced(baleGeo, baleItems));

    // the village: houses east of the main road, round the crossroads
    const free = (x: number, z: number) => Math.abs(x) > 0.5 && !inRect(PLAZA, x, z, 0.6) && !(server && inRect(LOT_BOX, x, z, 0.5)) && ok(x, z, 0.5);
    const vil = blocks(seed, 'vil', {x0: 0.5, x1: 3.2, z0: 2.95, z1: 7.2}, LAND, P.wall, {cell: 1.15, gap: 0.25, hMin: 0.18, hMax: 0.42, ok: free});
    const items = [...vil.items, ...farmItems];
    const records: Building[] = [...vil.records, ...farmRecords];
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), items);
    local.add(buildings);

    const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).toNonIndexed();
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, 0.5, 0);
    roofGeo.deleteAttribute('uv');
    const roofs = records.map((b, i) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.12, 0.2 + b.w * 0.18, b.d * 1.12), c: pick(seed, `roof${i}`, P.roof) as string}));
    if (roofs.length) local.add(instanced(roofGeo, roofs));

    const onBld = (x: number, z: number, pad: number) => records.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad);

    // the big barn in the accent colour: gable end to the camera, grey roof, pale door
    local.add(mesh(chamferBox(0.7, 0.5, 1.0, 0.02), accent, BARN.x, LAND, BARN.z));
    const prism = new THREE.CylinderGeometry(1, 1, 1, 3).toNonIndexed();
    prism.rotateX(-Math.PI / 2);
    prism.translate(0, 0.5, 0);
    prism.deleteAttribute('uv');
    const barnRoof = mesh(prism, P.barnRoof, BARN.x, LAND + 0.5, BARN.z);
    barnRoof.scale.set(0.46, 0.23, 1.06);
    local.add(barnRoof);
    local.add(slab(BARN.x - 0.14, BARN.x + 0.14, BARN.z + 0.49, BARN.z + 0.515, LAND, LAND + 0.3, P.trim));

    // grain silos beside the barn
    for (const s of SILOS) {
      const body = new THREE.CylinderGeometry(s.r, s.r, s.h, 9).toNonIndexed();
      body.deleteAttribute('uv');
      body.translate(0, s.h / 2, 0);
      local.add(mesh(body, P.silo, s.x, LAND, s.z));
      const cap = new THREE.ConeGeometry(s.r * 1.08, s.r * 0.9, 9).toNonIndexed();
      cap.deleteAttribute('uv');
      cap.translate(0, s.r * 0.45, 0);
      local.add(mesh(cap, P.siloCap, s.x, LAND + s.h, s.z));
    }

    // a few cars on the main road and the cross street
    const cars: {m: THREE.Matrix4; c: string}[] = [];
    const carSpots: [number, number, number][] = [[0.08, 10.3, Math.PI / 2], [-0.08, 8.1, Math.PI / 2], [0.08, -1.5, Math.PI / 2], [-0.08, -6, Math.PI / 2], [0.08, -11, Math.PI / 2], [-0.08, -17, Math.PI / 2], [-1.9, XST + 0.07, 0], [2.2, XST - 0.07, 0], [-4, XST + 0.07, 0]];
    carSpots.forEach(([x, z, r], i) => {
      if (ok(x, z, 0.1)) cars.push({m: mat4(x, LAND + 0.016, z, 0.7, 0.7, 0.7, r), c: pick(seed, `car${i}`, P.car) as string});
    });
    if (cars.length) local.add(instanced(carGeometry(), cars));

    // hedgerow trees, orchards and far tree clumps, keeping the rocket band open
    const treeOk = (x: number, z: number) =>
      !onBld(x, z, 0.12) && Math.abs(x) > 0.4 && !inRect(PLAZA, x, z, 0.25) && !inRect(YARD, x, z, 0.1) &&
      !(server && inRect(LOT_BOX, x, z, 0.2)) && Math.hypot(x - POND.x, z - POND.z) > POND.r + 0.1 &&
      Math.abs(z - XST) > 0.35 && !(x > -3.6 && x < 4.2 && z < -6.6 && z > -22) && ok(x, z, 0.3);
    const wood = {canopy: P.tree, trunk: P.trunk};
    local.add(forest(seed, 'tr1', [{x0: -7, x1: 7, z0: -6.5, z1: 12}], 150, LAND, wood, treeOk));
    local.add(forest(seed, 'tr3', [{x0: -14, x1: -3.6, z0: -22, z1: -6.6}, {x0: 4.2, x1: 14, z0: -22, z1: -6.6}], 70, LAND, wood, treeOk, 1.3));
    local.add(forest(seed, 'tr2', [{x0: -30, x1: 30, z0: -46, z1: -22}], 120, LAND, wood, treeOk, 1.8));

    // low rolling hills to the sides, then the row of wind turbines on their own hills
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const g = hill(seed, `roll${i}`, 7 + rand(seed, `rr${i}`) * 3, 1 + rand(seed, `rh${i}`) * 0.6, 7);
      local.add(mesh(g, pick(seed, `rc${i}`, P.hill) as string, side * (12 + rand(seed, `rx${i}`) * 8), LAND - 0.2, -20 - i * 3.5 - rand(seed, `rz${i}`) * 4));
    }
    const towerGeo = new THREE.CylinderGeometry(0.04, 0.08, 1, 6).toNonIndexed();
    towerGeo.deleteAttribute('uv');
    towerGeo.translate(0, 0.5, 0);
    const towers: {m: THREE.Matrix4; c: string}[] = [];
    const nacelles: {m: THREE.Matrix4; c: string}[] = [];
    const blades: {m: THREE.Matrix4; c: string}[] = [];
    for (let i = 0; i < 7; i++) {
      const x = -9 + i * 3 + (rand(seed, `tx${i}`) - 0.5) * 1.2;
      const z = -40 - (i % 3) * 6 - rand(seed, `tz${i}`) * 4;
      const hh = 1.4 + rand(seed, `th${i}`) * 0.6;
      local.add(mesh(hill(seed, `thill${i}`, 5.5 + rand(seed, `tr${i}`) * 1.5, hh, 7), pick(seed, `tc${i}`, P.hill) as string, x, LAND - 0.2, z));
      const by = LAND - 0.2 + hh - 0.05;
      const s = 0.9 + rand(seed, `ts${i}`) * 0.25;
      const H = 2.4 * s;
      towers.push({m: mat4(x, by, z, s, H, s), c: P.turbine});
      nacelles.push({m: mat4(x, by + H - 0.05 * s, z + 0.03 * s, s, s, s), c: P.turbine});
      const a0 = rand(seed, `ta${i}`) * 6.28;
      for (let k = 0; k < 3; k++) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a0 + (k * Math.PI * 2) / 3);
        blades.push({m: new THREE.Matrix4().compose(new THREE.Vector3(x, by + H + 0.04 * s, z + 0.2 * s), q, new THREE.Vector3(s, s, s)), c: P.turbine});
      }
    }
    local.add(instanced(towerGeo, towers), instanced(box(0.14, 0.1, 0.3), nacelles), instanced(box(0.14, 1.3, 0.02), blades));

    // hazy far ranges
    for (let i = 0; i < 12; i++) {
      const g = hill(seed, `far${i}`, 10 + rand(seed, `fr${i}`) * 4, 3.5 + rand(seed, `fh${i}`) * 2.5, 7);
      local.add(mesh(g, P.farHill, -50 + i * 9 + rand(seed, `fx${i}`) * 4, LAND - 0.2, -110 - rand(seed, `fz${i}`) * 30));
    }
    for (let i = 0; i < 10; i++) {
      const g = hill(seed, `far2${i}`, 12 + rand(seed, `gr${i}`) * 5, 5 + rand(seed, `gh${i}`) * 3, 7);
      local.add(mesh(g, P.farHill2, -55 + i * 11 + rand(seed, `gx${i}`) * 4, LAND - 0.2, -170 - rand(seed, `gz${i}`) * 25));
    }

    const cellRect = (c: Rect | undefined): Rect[] => (c ? [{x0: c.x0 + 0.1, x1: c.x1 - 0.1, z0: c.z0 + 0.1, z1: c.z1 - 0.1}] : []);
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
        {x0: -12, x1: 12, z0: XST - 0.18, z1: XST + 0.18},
        {x0: -0.2, x1: 0.2, z0: -14, z1: 14},
        ...cellRect(cells.find((c) => c.ri === 1 && c.x1 < 0)),
        ...cellRect(cells.find((c) => c.ri === 1 && c.x0 > 0)),
      ],
      snow: [{x0: -70, x1: 70, z0: -280, z1: 30}],
      lot: LOT,
      pads: {
        x0: -2.7,
        x1: 3.3,
        z: -19,
        ok: (w) => {
          const x = w.x;
          const z = w.z + 6;
          return !onBld(x, z, 0.3) && !inRect(YARD, x, z, 0.3) && Math.hypot(x - POND.x, z - POND.z) > POND.r + 0.3;
        },
      },
    };
  },
};
