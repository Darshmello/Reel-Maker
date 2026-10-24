// Suburbs: a quiet street of pastel ranch houses with pitched roofs, front yards, picket fences,
// driveways and street trees; a water tower in the accent colour; a school field and a hazy
// downtown behind dry hills.
// Frame (yaw 0, camera at world z=12, 24 deg lens): local z = world z + 6. The visible ground
// starts near local z 10.7 (only ~2.4 m wide there) and widens into the distance, so the bottom of
// the shot is the street itself plus the near corners of two fenced yards, and the houses start
// around local z 8 and recede toward the hero point at local z 0.
import {THREE, blocks, box, carGeometry, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const STREET: Rect = {x0: -0.4, x1: 0.2, z0: -40, z1: 12};
const WALK_L: Rect = {x0: -0.58, x1: -0.4, z0: -40, z1: 12};
const WALK_R: Rect = {x0: 0.2, x1: 0.38, z0: -40, z1: 12};
const CROSS: Rect = {x0: -20, x1: 18, z0: -9.8, z1: -9.0};
const YARD_R: Rect = {x0: 0.38, x1: 6.2, z0: 3.0, z1: 10.8};
const HOUSE_R = {x: 1.35, z: 4.9, w: 1.65, d: 1.2, h: 0.82};
const DRIVE: Rect = {x0: 0.22, x1: 1.25, z0: 7.5, z1: 8.8};
const YARD_L: Rect = {x0: -6.4, x1: -0.8, z0: 2.4, z1: 10.8};
const LOT = {x: -2.7, z: -2.4, hx: 0.7, hz: 0.45};
const TOWER = {x: 2.7, z: -12.6};
const SCHOOL = {x0: -8.6, x1: -3.4, z0: -17.0, z1: -13.6};
const PLAY: Rect = {x0: -8.4, x1: -3.8, z0: -13.0, z1: -10.0};
const RIDGE: [number, number][] = [[-38, -70], [-12, -82], [18, -76], [-58, -96], [46, -92], [72, -104]];

export const pack: SetPack = {
  hero: {x: -1.4, z: -0.6, yaw: 0.16},
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
    const inSchool = (x: number, z: number) => inRect(SCHOOL, x, z, 0.4) || inRect(PLAY, x, z, 0.2);
    const free = (x: number, z: number) => !onStreet(x, z, 0.05) && !inRect(YARD_R, x, z, 0.2) && !inRect(YARD_L, x, z, 0.2) && !inRect(DRIVE, x, z, 0.1) && !inSchool(x, z) && !onLot(x, z) && ok(x, z, 0.4);

    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-90, 90, -320, 40, -1, LAND, P.grass));

    // ---- ground: street, sidewalks, a cross street, driveways, front paths
    local.add(slab(STREET.x0, STREET.x1, STREET.z0, STREET.z1, LAND, LAND + 0.008, P.asphalt));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z0, CROSS.z1, LAND, LAND + 0.008, P.asphalt));
    local.add(slab(WALK_L.x0, WALK_L.x1, WALK_L.z0, WALK_L.z1, LAND, LAND + 0.014, P.concrete));
    local.add(slab(WALK_R.x0, WALK_R.x1, WALK_R.z0, WALK_R.z1, LAND, LAND + 0.014, P.concrete));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z0 - 0.16, CROSS.z0, LAND, LAND + 0.014, P.concrete));
    local.add(slab(CROSS.x0, CROSS.x1, CROSS.z1, CROSS.z1 + 0.16, LAND, LAND + 0.014, P.concrete));
    const dashes: Item[] = [];
    for (let z = -38; z < 11; z += 1.6) dashes.push({m: mat4((STREET.x0 + STREET.x1) / 2, LAND + 0.012, z, 0.03, 0.006, 0.26), c: P.dash});
    local.add(instanced(box(1, 1, 1), dashes, false));

    const wins: Item[] = [];
    const pickets: Item[] = [];
    const shrubs: Item[] = [];
    const cars: Item[] = [];

    // ---- one ranch house: body, hip roof, chimney, porch, door, windows. front = +z
    const house = (x: number, z: number, w: number, d: number, h: number, siding: string, roofC: string) => {
      local.add(mesh(chamferBox(w, h, d, 0.02), siding, x, LAND, z));
      const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).toNonIndexed();
      roof.rotateY(Math.PI / 4);
      roof.translate(0, 0.5, 0);
      roof.deleteAttribute('uv');
      const r = new THREE.Mesh(roof, flat(col(roofC)));
      r.position.set(x, LAND + h, z);
      r.scale.set(w * 1.14, h * 0.6, d * 1.14);
      r.castShadow = true;
      r.receiveShadow = true;
      local.add(r);
      local.add(mesh(box(0.12, 0.3, 0.12), P.concrete, x + w * 0.28, LAND + h + h * 0.34, z - d * 0.2));
      // porch slab, two posts and a small porch roof on the camera side
      local.add(slab(x - w * 0.3, x + w * 0.3, z + d / 2, z + d / 2 + 0.26, LAND, LAND + 0.05, P.porch));
      for (const px of [x - w * 0.28, x + w * 0.28]) local.add(mesh(box(0.04, 0.26, 0.04), P.trim, px, LAND + 0.05, z + d / 2 + 0.22));
      local.add(mesh(box(w * 0.64, 0.05, 0.3), roofC, x, LAND + 0.3, z + d / 2 + 0.13));
      local.add(mesh(box(0.17, 0.44, 0.03), P.door, x - w * 0.2, LAND, z + d / 2 + 0.015));
      for (const dx of [-0.02, 0.24]) wins.push({m: mat4(x + w * dx, LAND + h * 0.36, z + d / 2 + 0.02, 0.26, 0.22, 0.03), c: P.window});
      wins.push({m: mat4(x + w / 2 + 0.02, LAND + h * 0.4, z - d * 0.1, 0.03, 0.2, 0.3), c: P.window});
      // path from the porch to the sidewalk
      local.add(slab(x + w * 0.2 - 0.12, x + w * 0.2 + 0.12, z + d / 2 + 0.26, z + d / 2 + 1.5, LAND, LAND + 0.012, P.concrete));
      return {x, z, w, d, h};
    };

    // ---- the near right lot: the hero house, its yard, fence, gate, driveway and car
    local.add(slab(YARD_R.x0, YARD_R.x1, YARD_R.z0, YARD_R.z1, LAND, LAND + 0.012, P.lawn));
    house(HOUSE_R.x, HOUSE_R.z, HOUSE_R.w, HOUSE_R.d, HOUSE_R.h, P.siding[0], P.roof[0]);
    local.add(slab(DRIVE.x0, DRIVE.x1, DRIVE.z0, DRIVE.z1, LAND, LAND + 0.014, P.concrete));
    cars.push({m: mat4(0.78, LAND + 0.014, (DRIVE.z0 + DRIVE.z1) / 2, 1, 1, 1, 0), c: pick(seed, 'herocar', P.car)});
    for (let z = YARD_R.z0 + 0.4; z < YARD_R.z1; z += 0.22) {
      if (z > DRIVE.z0 - 0.25 && z < DRIVE.z1 + 0.25) continue;
      pickets.push({m: mat4(YARD_R.x0 + 0.04, LAND + 0.01, z, 0.035, 0.22, 0.035), c: P.fence});
    }
    local.add(slab(YARD_R.x0 + 0.02, YARD_R.x0 + 0.06, YARD_R.z0 + 0.4, DRIVE.z0 - 0.25, LAND + 0.11, LAND + 0.14, P.fence));
    local.add(slab(YARD_R.x0 + 0.02, YARD_R.x0 + 0.06, DRIVE.z1 + 0.25, YARD_R.z1, LAND + 0.11, LAND + 0.14, P.fence));
    local.add(mesh(box(0.04, 0.26, 0.04), P.trim, YARD_R.x0 + 0.08, LAND, DRIVE.z1 + 0.5));
    local.add(mesh(box(0.13, 0.1, 0.17), P.door, YARD_R.x0 + 0.08, LAND + 0.26, DRIVE.z1 + 0.5));
    for (const [hx, hz] of [[HOUSE_R.x - HOUSE_R.w * 0.4, HOUSE_R.z + HOUSE_R.d / 2 + 0.18], [HOUSE_R.x + HOUSE_R.w * 0.42, HOUSE_R.z + HOUSE_R.d / 2 + 0.18]]) {
      shrubs.push({m: mat4(hx, LAND + 0.02, hz, 0.24, 0.17, 0.17, 0.4), c: pick(seed, `sh${hx}`, P.hedge)});
    }

    // ---- the near left lot: a corner yard, fence, hedge, mailbox and a big street tree
    local.add(slab(YARD_L.x0, YARD_L.x1, YARD_L.z0, YARD_L.z1, LAND, LAND + 0.012, P.lawn));
    for (let z = YARD_L.z0 + 0.2; z < YARD_L.z1; z += 0.22) pickets.push({m: mat4(YARD_L.x1 - 0.04, LAND + 0.01, z, 0.035, 0.22, 0.035), c: P.fence});
    local.add(slab(YARD_L.x1 - 0.06, YARD_L.x1 - 0.02, YARD_L.z0 + 0.2, YARD_L.z1, LAND + 0.11, LAND + 0.14, P.fence));
    local.add(slab(YARD_L.x0 + 1.6, YARD_L.x0 + 1.72, YARD_L.z1 - 1.6, YARD_L.z1, LAND + 0.05, LAND + 0.42, P.fence));
    local.add(mesh(box(0.04, 0.26, 0.04), P.trim, YARD_L.x1 - 0.15, LAND, YARD_L.z0 + 1.1));
    local.add(mesh(box(0.13, 0.1, 0.17), P.door, YARD_L.x1 - 0.15, LAND + 0.26, YARD_L.z0 + 1.1));
    // a second house further left, mostly cut by the frame, and one across the street
    house(-2.5, 4.6, 1.9, 1.25, 0.8, P.siding[3], P.roof[2]);
    house(3.9, 1.9, 1.8, 1.2, 0.78, P.siding[2], P.roof[1]);
    // the left lot's driveway, its car, and a garden bed along the fence
    local.add(slab(-4.2, -0.42, 5.5, 6.5, LAND, LAND + 0.014, P.concrete));
    cars.push({m: mat4(-2.7, LAND + 0.014, 6.0, 1, 1, 1, 0), c: pick(seed, 'car2', P.car)});
    local.add(slab(-5.9, -5.3, 3.2, 8.8, LAND + 0.012, LAND + 0.02, P.hedge[0]));
    // street lamps and a hydrant: small readable things at the kerb
    for (const [lx, lz] of [[-0.52, 2.4], [0.32, -3.4]]) {
      local.add(mesh(box(0.035, 0.85, 0.035), P.trim, lx, LAND, lz));
      local.add(mesh(box(0.16, 0.03, 0.03), P.trim, lx + Math.sign(-lx) * 0.08, LAND + 0.85, lz));
      local.add(mesh(box(0.08, 0.05, 0.08), P.dash, lx + Math.sign(-lx) * 0.16, LAND + 0.83, lz));
    }
    local.add(mesh(box(0.07, 0.14, 0.07), P.car[0], 0.46, LAND, 4.1));
    local.add(mesh(box(0.09, 0.04, 0.09), P.car[0], 0.46, LAND + 0.14, 4.1));

    // ---- mid-block rows either side of the street (these are what the towers act grows)
    const rowL = blocks(seed, 'rowL', {x0: -9.4, x1: -0.95, z0: -8.6, z1: -0.2}, LAND, P.siding, {cell: 1.35, gap: 0.22, hMin: 0.36, hMax: 0.72, ok: free, heightAt: (x, z) => THREE.MathUtils.clamp((z + 12) / 12, 0.7, 1.05)});
    const rowR = blocks(seed, 'rowR', {x0: 0.6, x1: 9.0, z0: -8.6, z1: 0.2}, LAND, P.siding, {cell: 1.35, gap: 0.22, hMin: 0.34, hMax: 0.7, ok: free});
    const rowF = blocks(seed, 'rowF', {x0: -9.4, x1: -0.95, z0: -21.0, z1: -10.6}, LAND, P.siding, {cell: 1.5, gap: 0.3, hMin: 0.3, hMax: 0.6, ok: free, heightAt: () => 0.9});
    const rowFR = blocks(seed, 'rowFR', {x0: 0.6, x1: 9.0, z0: -21.0, z1: -10.6}, LAND, P.siding, {cell: 1.5, gap: 0.3, hMin: 0.3, hMax: 0.6, ok: free, heightAt: () => 0.9});
    const rows = [rowL, rowR, rowF, rowFR];
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), rows.flatMap((r) => r.items));
    local.add(buildings);
    const records = rows.flatMap((r) => r.records);
    // low picket fences along the row fronts, with a gap every few lots for a driveway
    for (let z = -8.4; z < 0; z += 0.22) {
      if ((z + 8.4) % 4.2 < 0.3) continue;
      pickets.push({m: mat4(-0.95, LAND + 0.01, z, 0.035, 0.2, 0.035), c: P.fence});
      pickets.push({m: mat4(0.56, LAND + 0.01, z, 0.035, 0.2, 0.035), c: P.fence});
    }
    const roofs: Item[] = records.map((b) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 1.16, 0.16 + b.h * 0.55, b.d * 1.16), c: pick(seed, `rr${b.x}:${b.z}`, P.roof)}));
    for (const b of records) if (b.z > -9) wins.push({m: mat4(b.x, LAND + b.h * 0.42, b.z + b.d / 2 + 0.012, b.w * 0.42, 0.18, 0.02), c: P.window});
    local.add(instanced(roofGeoUnit(), roofs));
    if (wins.length) local.add(instanced(box(1, 1, 1), wins, false));
    if (pickets.length) local.add(instanced(box(1, 1, 1), pickets));
    if (shrubs.length) local.add(instanced(new THREE.IcosahedronGeometry(1, 0), shrubs));
    if (cars.length) local.add(instanced(carGeometry(), cars));

    // ---- street trees in the parkway strips and the yards
    const trees = forest(seed, 'tree', [
      {x0: -0.78, x1: -0.6, z0: -22, z1: 6},
      {x0: 0.24, x1: 0.42, z0: -22, z1: 6},
      {x0: -5.9, x1: -4.9, z0: 2.8, z1: 10.2},
      {x0: 5.2, x1: 6.0, z0: 3.6, z1: 10.2},
      {x0: -9.0, x1: -7.6, z0: -22, z1: -10.6},
    ], 46, LAND, {canopy: P.tree, trunk: P.trunk}, (x, z) => !onStreet(x, z, 0.16) && !inRect(DRIVE, x, z, 0.1) && !inRect(PLAY, x, z, 0.2) && !inRect(SCHOOL, x, z, 0.4) && !onLot(x, z) && ok(x, z, 0.15), 0.95);
    local.add(trees);
    // the big tree in the near-left yard, the one you notice first
    local.add(forest(seed, 'bigtree', [{x0: -0.9, x1: -0.86, z0: 8.3, z1: 8.35}], 1, LAND, {canopy: P.tree, trunk: P.trunk}, () => true, 1.35));
    local.add(forest(seed, 'bigtree2', [{x0: 0.62, x1: 0.66, z0: 9.8, z1: 9.85}], 1, LAND, {canopy: P.tree, trunk: P.trunk}, () => true, 1.15));

    // ---- the landmark: a water tower in the accent colour, right of the street
    const tower = new THREE.Group();
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower.add(mesh(box(0.07, 2.1, 0.07), P.trim, TOWER.x + dx * 0.34, LAND, TOWER.z + dz * 0.34));
    for (const y of [0.55, 1.3, 1.95]) tower.add(mesh(box(0.8, 0.035, 0.035), P.trim, TOWER.x, LAND + y, TOWER.z - 0.34), mesh(box(0.8, 0.035, 0.035), P.trim, TOWER.x, LAND + y, TOWER.z + 0.34));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.54, 10).toNonIndexed(), flat(col(accent)));
    tank.position.set(TOWER.x, LAND + 2.36, TOWER.z);
    tank.castShadow = true;
    tank.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.3, 10).toNonIndexed(), flat(col(accent)));
    cap.position.set(TOWER.x, LAND + 2.78, TOWER.z);
    cap.castShadow = true;
    tower.add(tank, cap);
    local.add(tower);

    // ---- school: a long low hall, a flag pole and a playing field with a track ring
    local.add(mesh(chamferBox(SCHOOL.x1 - SCHOOL.x0, 0.55, SCHOOL.z1 - SCHOOL.z0, 0.02), P.siding[1], (SCHOOL.x0 + SCHOOL.x1) / 2, LAND, (SCHOOL.z0 + SCHOOL.z1) / 2));
    local.add(slab(SCHOOL.x0 - 0.1, SCHOOL.x1 + 0.1, SCHOOL.z0 - 0.1, SCHOOL.z1 + 0.1, LAND + 0.55, LAND + 0.6, P.roof[2]));
    local.add(mesh(box(0.03, 1.5, 0.03), P.trim, SCHOOL.x1 - 0.5, LAND, SCHOOL.z0 + 0.4));
    local.add(slab(PLAY.x0, PLAY.x1, PLAY.z0, PLAY.z1, LAND, LAND + 0.01, P.field));
    const ring = (x0: number, x1: number, z0: number, z1: number, w = 0.05) => {
      local.add(slab(x0, x1, z0, z0 + w, LAND + 0.012, LAND + 0.016, P.track));
      local.add(slab(x0, x1, z1 - w, z1, LAND + 0.012, LAND + 0.016, P.track));
      local.add(slab(x0, x0 + w, z0, z1, LAND + 0.012, LAND + 0.016, P.track));
      local.add(slab(x1 - w, x1, z0, z1, LAND + 0.012, LAND + 0.016, P.track));
    };
    ring(PLAY.x0 + 0.15, PLAY.x1 - 0.15, PLAY.z0 + 0.15, PLAY.z1 - 0.15);
    ring(PLAY.x0 + 0.55, PLAY.x1 - 0.55, PLAY.z0 + 0.45, PLAY.z1 - 0.45, 0.03);

    // ---- hazy downtown behind the block, then dry hills
    const skyline = blocks(seed, 'sky', {x0: -52, x1: 52, z0: -120, z1: -78}, LAND, P.siding, {cell: 5.5, gap: 0.55, hMin: 1.0, hMax: 2.4, far: true});
    local.add(instanced(chamferBox(1, 1, 1, 0.02), skyline.items));
    for (let i = 0; i < RIDGE.length; i++) {
      const g = hill(seed, `ridge${i}`, 13 + rand(seed, `rg${i}`) * 7, 2.2 + rand(seed, `rh${i}`) * 2.0, 6);
      local.add(mesh(g, i % 2 === 0 ? P.hill : P.hillFar, RIDGE[i][0], LAND - 0.2, RIDGE[i][1]));
    }

    // rocket pads in the empty field behind the school, off every house and the tower
    const pads = {
      x0: -3.4,
      x1: 3.6,
      z: -26,
      ok: (w: THREE.Vector3) => {
        const x = w.x, z = w.z + 6;
        if (z > -22 || z < -32) return false;
        if (Math.abs(x) < 0.9) return false;
        if (onLot(x, z)) return false;
        if (Math.hypot(x - TOWER.x, z - TOWER.z) < 2.2) return false;
        if (inSchool(x, z)) return false;
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
      walk: [YARD_R, YARD_L, STREET, WALK_L, WALK_R, CROSS, PLAY],
      snow: [{x0: -90, x1: 90, z0: -320, z1: 40}],
      lot: LOT,
      pads,
    };
  },
};

// a unit hip roof (1x1 base, height 1, base at y=0) shared by every row house
let roofCache: THREE.BufferGeometry | null = null;
function roofGeoUnit() {
  if (roofCache) return roofCache;
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).toNonIndexed();
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  g.deleteAttribute('uv');
  roofCache = g;
  return g;
}
