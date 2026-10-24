// Bay Area Suburbia: a runner's house on a quiet suburban San Jose street, front yard and street trees,
// a row of pastel ranch houses down the block, a water tower in the accent colour, and dry hills behind.
// Frame (yaw 0): local z = world z + 6; the lower frame edge meets the ground near local z 10.7, its
// centre near local z 1; at local z 0 the frame is only ~4 m wide.
import {THREE, blocks, box, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.3;
const WATER_Y = LAND - 0.1;
const YARD: Rect = {x0: -3.6, x1: -0.75, z0: 2.2, z1: 8.8};
const HOUSE = {x: -1.45, z: 5.6, w: 1.5, d: 1.05, h: 0.85};
const STREET: Rect = {x0: 0.15, x1: 0.62, z0: -14, z1: 12};
const LOT = {x: -2.6, z: -0.4, hx: 0.7, hz: 0.45};
const TOWER = {x: 1.3, z: -5.6};
const RIDGE: [number, number][] = [[-34, -78], [-8, -64], [22, -88], [-52, -98], [64, -76]];

export const pack: SetPack = {
  hero: {x: -1.4, z: -0.7, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);

    const inYard = (x: number, z: number) => x > YARD.x0 && x < YARD.x1 && z > YARD.z0 && z < YARD.z1;
    const onStreet = (x: number, z: number, pad = 0) => x > STREET.x0 - pad && x < STREET.x1 + pad && z > STREET.z0 && z < STREET.z1;
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.5 && Math.abs(z - LOT.z) < LOT.hz + 0.5;
    const inHouse = (x: number, z: number, pad = 0) => Math.abs(x - HOUSE.x) < HOUSE.w / 2 + pad && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + pad;
    const free = (x: number, z: number) => !inYard(x, z) && !onStreet(x, z, 0.05) && !onLot(x, z) && ok(x, z, 0.4);

    // the sea sits just under the lawn: water acts flood the suburb from below
    const water = sea(P.water);
    group.add(water);
    local.add(slab(-60, 60, -120, 40, -1, LAND, P.grass));
    local.add(slab(YARD.x0, YARD.x1, YARD.z0, YARD.z1, LAND, LAND + 0.012, P.lawn));
    local.add(slab(STREET.x0, STREET.x1, STREET.z0, STREET.z1, LAND, LAND + 0.008, P.street));
    local.add(slab(STREET.x0 - 0.16, STREET.x0, STREET.z0, STREET.z1, LAND, LAND + 0.014, P.porch));
    local.add(slab(STREET.x1, STREET.x1 + 0.16, STREET.z0, STREET.z1, LAND, LAND + 0.014, P.porch));
    const dashes: Item[] = [];
    for (let z = -13; z < 11; z += 1.5) dashes.push({m: mat4((STREET.x0 + STREET.x1) / 2, LAND + 0.012, z, 0.035, 0.006, 0.34), c: P.porch});
    local.add(instanced(box(1, 1, 1), dashes, false));

    // the house the runner starts in: pale ranch walls, terracotta pyramid roof, front windows, porch
    const houseBody = new THREE.Mesh(chamferBox(HOUSE.w, HOUSE.h, HOUSE.d, 0.02), flat(col(P.siding[2])));
    houseBody.position.set(HOUSE.x, LAND, HOUSE.z);
    houseBody.castShadow = true;
    houseBody.receiveShadow = true;
    const roofGeo = new THREE.ConeGeometry(0.7071, 1, 4, 1).toNonIndexed();
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, 0.5, 0);
    const houseRoof = new THREE.Mesh(roofGeo, flat(col(P.roof)));
    houseRoof.position.set(HOUSE.x, LAND + HOUSE.h, HOUSE.z);
    houseRoof.scale.set(HOUSE.w * 1.04, HOUSE.h * 0.8, HOUSE.d * 1.04);
    houseRoof.castShadow = true;
    houseRoof.receiveShadow = true;
    local.add(houseBody, houseRoof);
    local.add(slab(HOUSE.x - 0.8, HOUSE.x + 0.8, HOUSE.z - HOUSE.d / 2 - 0.12, HOUSE.z - HOUSE.d / 2 + 0.18, LAND, LAND + 0.05, P.porch));
    const door = new THREE.Mesh(chamferBox(0.16, 0.34, 0.05, 0.01), flat(col(P.door)));
    door.position.set(HOUSE.x, LAND, HOUSE.z - HOUSE.d / 2 - 0.06);
    local.add(door);
    const wins: Item[] = [];
    for (const wx of [HOUSE.x - 0.45, HOUSE.x - 0.12, HOUSE.x + 0.21]) {
      wins.push({m: mat4(wx, LAND + 0.14, HOUSE.z - HOUSE.d / 2 - 0.006, 0.26, 0.28, 0.012), c: P.window});
    }
    if (wins.length) local.add(instanced(box(1, 1, 1), wins, false));

    // the street row of pastel ranch houses, low near the camera, taller toward the back
    const town = blocks(seed, 'town', {x0: -9.5, x1: -0.72, z0: -11, z1: 8.6}, LAND, P.siding, {cell: 1.2, gap: 0.15, hMin: 0.3, hMax: 0.8, ok: free});
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), town.items);
    local.add(buildings);
    const roofs: Item[] = [];
    town.records.forEach((b, i) => {
      if (i % 3 !== 0) return;
      roofs.push({m: mat4(b.x, LAND + b.h, b.z, b.w * 0.9, 0.05, b.d * 0.9), c: P.roof});
    });
    if (roofs.length) local.add(instanced(chamferBox(1, 1, 1, 0.01), roofs));

    // trees on the yard edges and the street sides, clear of the house and the road
    const trees = forest(seed, 'tree', [
      {x0: -4.55, x1: -3.15, z0: 2.45, z1: 8.35},
      {x0: -1.5, x1: -1.25, z0: 2.45, z1: 8.35},
      {x0: -9.3, x1: -8.6, z0: -14, z1: -11.5},
      {x0: -9.3, x1: -8.6, z0: 8.9, z1: 12},
      {x0: -0.2, x1: -0.06, z0: -13, z1: 11},
      {x0: 0.79, x1: 0.96, z0: -13, z1: 11},
    ], 26, LAND, {canopy: P.tree, trunk: P.trunk}, (x, z) => !inHouse(x, z, 0.25) && !onStreet(x, z, 0.25) && ok(x, z, 0.2));
    local.add(trees);

    // the signature landmark: the water tower in the accent colour, mid block
    const tower = new THREE.Group();
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.6, 8).toNonIndexed(), flat(col(accent)));
    towerBody.position.set(TOWER.x, LAND + 1.3, TOWER.z);
    towerBody.castShadow = true;
    towerBody.receiveShadow = true;
    const towerTank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10).toNonIndexed(), flat(col(accent)));
    towerTank.position.set(TOWER.x, LAND + 2.75, TOWER.z);
    towerTank.castShadow = true;
    tower.add(towerBody, towerTank);
    local.add(tower);

    // hazy far layer: dry hills behind the block
    const hills = new THREE.Group();
    for (let i = 0; i < RIDGE.length; i++) {
      const g = hill(seed, `ridge${i}`, 11 + rand(seed, `rg${i}`) * 5, 2 + rand(seed, `rh${i}`) * 1.8, 6);
      const m = new THREE.Mesh(g, flat(col(i % 2 === 0 ? P.hill : P.hillFar)));
      m.position.set(RIDGE[i][0], LAND - 0.2, RIDGE[i][1]);
      m.receiveShadow = true;
      hills.add(m);
    }
    local.add(hills);

    // rocket pads behind the block, off every building and landmark
    const pads = {
      x0: -2.7,
      x1: 3.3,
      z: -20,
      ok: (w: THREE.Vector3) => {
        const x = w.x, z = w.z + 6;
        if (z > -12 || z < -30) return false;
        if (Math.abs(x) < 0.9) return false;
        if (onLot(x, z)) return false;
        if (Math.hypot(x - TOWER.x, z - TOWER.z) < 2.5) return false;
        if (town.records.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.3 && Math.abs(z - b.z) < b.d / 2 + 0.3)) return false;
        return true;
      },
    };

    // a quiet far field people can walk into
    const field: Rect = {x0: -8, x1: -0.72, z0: -30, z1: -24};

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records: town.records,
      walk: [YARD, STREET, field],
      snow: [{x0: -8, x1: 2, z0: -38, z1: -30}],
      lot: LOT,
      pads,
    };
  },
};
