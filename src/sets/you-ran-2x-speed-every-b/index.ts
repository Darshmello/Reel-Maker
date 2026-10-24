// You Ran 2x Speed: a Bay Area suburb at walking pace, small pastel houses behind a long road the
// walk happens on, and distant hills in the haze. Frame (yaw 0): local z = world z + 6; the camera's
// lower frame edge meets the ground near local z 10, its centre near local z 1; at local z 0 the frame
// is only ~4 m wide.
import {THREE, blocks, box, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, sea, slab} from '../kit';
import type {Building, SetPack} from '../kit';
import {P} from './palette';

const LAND = 0.3;
const HERO = {x: -1.0, z: 5.4}; // local: the film's hero spot, world (x -1, z -0.6)
const LOT = {x: 0.9, z: -0.6, hx: 0.7, hz: 0.45};
const ROAD = {x0: -0.5, x1: 0.1, z0: -20, z1: 14};
const LAWN = {x0: -2.0, x1: -0.55, z0: 4.3, z1: 7.6};
const TOWER = {x: 1.5, z: 3.2};

export const pack: SetPack = {
  hero: {x: -1.0, z: -0.6, yaw: 0},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);

    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-70, 70, -70, 70, -1, LAND, P.grass));

    // the road the walk happens on
    local.add(slab(ROAD.x0, ROAD.x1, ROAD.z0, ROAD.z1, LAND, LAND + 0.008, P.asphalt));

    // the front lawns of the houses lining the road
    local.add(slab(LAWN.x0, LAWN.x1, LAWN.z0, LAWN.z1, LAND, LAND + 0.006, P.lawn));

    // the house the film starts in, on its front lawn
    const house = new THREE.Group();
    const body = new THREE.Mesh(chamferBox(1.25, 1.05, 0.95, 0.02), flat(col(P.siding[2])));
    body.position.set(-1.8, LAND, 6.2);
    const roof = new THREE.Mesh(chamferBox(1.4, 0.1, 1.05, 0.015), flat(col(P.roof[0])));
    roof.position.set(-1.8, LAND + 1.05, 6.2);
    const door = new THREE.Mesh(box(0.09, 0.52, 0.04, -2.02, LAND + 0.26, 6.2), flat(col(P.wood)));
    house.add(body, roof, door);
    local.add(house);

    // the signature landmark: water tower in the accent colour, across the road from the house
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 1.2, 8).toNonIndexed(), flat(col(accent)));
    tank.position.set(TOWER.x, LAND + 1.9, TOWER.z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 2.4, 6).toNonIndexed(), flat(col(P.trunk)));
    leg.position.set(TOWER.x, LAND + 1.2, TOWER.z);
    local.add(tank, leg);

    const onRoad = (x: number, z: number) => x > ROAD.x0 - 0.06 && x < ROAD.x1 + 0.06 && z > ROAD.z0 - 0.06 && z < ROAD.z1 + 0.06;
    const onLawn = (x: number, z: number) => Math.abs(x - HERO.x) < 1.8 && Math.abs(z - HERO.z) < 1.9;
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.4 && Math.abs(z - LOT.z) < LOT.hz + 0.4;
    const free = (x: number, z: number) => !onRoad(x, z) && !onLawn(x, z) && !onLot(x, z) && ok(x, z, 0.3);

    // the suburb behind the hero: two rows of small pastel houses
    const rowW = blocks(seed, 'w', {x0: -8.5, x1: -3.4, z0: -12, z1: 2}, LAND, P.siding, {cell: 1.45, gap: 0.25, hMin: 0.5, hMax: 1.2, ok: free});
    const rowE = blocks(seed, 'e', {x0: 1.5, x1: 8.5, z0: -18, z1: -6}, LAND, P.siding, {cell: 1.45, gap: 0.25, hMin: 0.45, hMax: 1.05, ok: free});
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), [...rowW.items, ...rowE.items]);
    local.add(buildings);
    const records: Building[] = [...rowW.records, ...rowE.records];

    // flat roofs get a parapet lip: a thin slab on top of every third house
    const roofs = records.filter((_, i) => i % 3 === 0).map((b) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 0.9, 0.04, b.d * 0.9), c: P.roof[0]}));
    if (roofs.length) local.add(instanced(chamferBox(1, 1, 1, 0.01), roofs));

    // trees over the yards and the far field, skipping the road, the lawn and the hero spot
    const trees = forest(seed, 'tree', [
      {x0: -5.2, x1: -2.9, z0: 8.6, z1: 11.4},
      {x0: 0.6, x1: 2.9, z0: 8.6, z1: 11.4},
      {x0: -9.0, x1: -7.0, z0: -6, z1: 4},
    ], 18, LAND, {canopy: P.tree, trunk: P.trunk}, (x, z) => !onRoad(x, z) && !onLawn(x, z) && !onLot(x, z) && ok(x, z, 0.2), 1);
    local.add(trees);

    // hazy far layer: hills behind the suburb
    const hills = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const g = hill(seed, `h${i}`, 16 + i * 5, 2.4 + i * 0.7, 6);
      const m = new THREE.Mesh(g, flat(col(P.hill)));
      m.position.set(-30 + i * 30, LAND - 0.2, -70 - i * 16);
      m.receiveShadow = true;
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
      walk: [
        {x0: -1.75, x1: -0.55, z0: 4.6, z1: 7.2},
        {x0: -0.45, x1: 0.1, z0: -20, z1: 14},
        {x0: -9, x1: 9, z0: -34, z1: -27},
      ],
      snow: [{x0: -40, x1: 40, z0: -50, z1: -42}],
      lot: LOT,
      pads: {
        x0: -4.5,
        x1: 4.5,
        z: -18,
        ok: (w: THREE.Vector3) => {
          const x = w.x, z = w.z + 6;
          if (z < -34 || z > -6) return false;
          if (Math.abs(x - LOT.x) < LOT.hx + 0.3 && Math.abs(z - LOT.z) < LOT.hz + 0.3) return false;
          if (Math.hypot(x - TOWER.x, z - TOWER.z) < 2.1) return false;
          if (z > -13 && z < 3 && x > -8.6 && x < -3.2) return false;
          if (z > -20 && z < -8 && x > 1.5 && x < 8.6) return false;
          return true;
        },
      },
    };
  },
};
