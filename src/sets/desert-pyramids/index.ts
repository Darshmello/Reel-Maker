// Desert Pyramids: a low adobe town on warm sand, a palm oasis by the plaza, dunes, and three
// pyramids fading into the haze. The accent colour is on the pyramids' capstones.
// Frame (yaw 0): local z = world z + 6. The camera's lower frame edge meets the ground near local
// z 10, its centre near local z 1; at local z 0 the frame is only ~4 m wide.
import {THREE, blocks, chamferBox, col, flat, forest, frame, hill, instanced, isClear, mat4, rand, sea, slab} from '../kit';
import type {SetPack} from '../kit';
import {P} from './palette';

const LAND = 0.3;
const PLAZA = {x0: -1.7, x1: 0.5, z0: 3.6, z1: 6.6};
const LOT = {x: 1.7, z: 0.6, hx: 0.7, hz: 0.45};

export const pack: SetPack = {
  hero: {x: -0.7, z: -0.8, yaw: 0.2},
  build: ({seed, accent, server, clear}) => {
    const {group, local, toWorld} = frame(0);
    const ok = isClear(toWorld, clear);

    // the sea sits just under the sand: water acts flood the desert from below
    const water = sea(P.sea);
    group.add(water);
    local.add(slab(-70, 70, -280, 30, -1, LAND, P.sand));
    local.add(slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, LAND, LAND + 0.01, P.plaza));
    local.add(slab(-12, 12, 2.3, 2.7, LAND, LAND + 0.008, P.road)); // cross street
    local.add(slab(-0.22, 0.22, -14, 14, LAND, LAND + 0.008, P.road)); // main street

    // oasis pond behind the plaza
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.02, 9).toNonIndexed(), flat(col(P.pond)));
    pond.position.set(-1.1, LAND + 0.005, 1.2);
    pond.receiveShadow = true;
    local.add(pond);

    // adobe town either side of the main street, low near the camera, skipping plaza, lot and pond
    const inPlaza = (x: number, z: number) => x > PLAZA.x0 - 0.5 && x < PLAZA.x1 + 0.5 && z > PLAZA.z0 - 0.5 && z < PLAZA.z1 + 0.5;
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.5 && Math.abs(z - LOT.z) < LOT.hz + 0.5;
    const nearPond = (x: number, z: number) => Math.hypot(x + 1.1, z - 1.2) < 1.4;
    const free = (x: number, z: number) => Math.abs(x) > 0.75 && Math.abs(z - 2.5) > 0.7 && !inPlaza(x, z) && !onLot(x, z) && !nearPond(x, z) && ok(x, z, 0.5);
    const town = blocks(seed, 'town', {x0: -10, x1: 10, z0: -16, z1: 13}, LAND, P.adobe, {cell: 1.05, gap: 0.22, hMin: 0.22, hMax: 0.75, ok: free, heightAt: (x, z) => THREE.MathUtils.clamp((8 - z) / 10, 0.35, 1)});
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), town.items);
    local.add(buildings);

    // flat roofs get a parapet lip: a thin slab on top of every third house
    const lips = town.records.filter((_, i) => i % 3 === 0).map((b) => ({m: mat4(b.x, LAND + b.h, b.z, b.w * 0.9, 0.04, b.d * 0.9), c: P.adobe[3]}));
    if (lips.length) local.add(instanced(chamferBox(1, 1, 1, 0.01), lips));

    // palms around the oasis and along the street
    const palms = forest(seed, 'palm', [{x0: -2.0, x1: -0.2, z0: 0.3, z1: 2.1}], 9, LAND, {canopy: P.palm, trunk: P.trunk}, (x, z) => ok(x, z, 0.2) && Math.hypot(x + 1.1, z - 1.2) > 0.8, 1.1);
    local.add(palms);
    local.add(forest(seed, 'street', [{x0: 0.3, x1: 0.6, z0: -10, z1: 12}, {x0: -0.6, x1: -0.3, z0: -10, z1: 12}], 12, LAND, {canopy: P.palm, trunk: P.trunk}, (x, z) => ok(x, z, 0.2)));

    // dunes on the horizon and three pyramids in the haze; capstones in the accent
    const dunes = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const g = hill(seed, `dune${i}`, 6 + rand(seed, `dr${i}`) * 8, 1.2 + rand(seed, `dh${i}`) * 1.4, 6);
      const m = new THREE.Mesh(g, flat(col(P.dune)));
      m.position.set(-60 + i * 9 + rand(seed, `dx${i}`) * 4, LAND - 0.2, -60 - rand(seed, `dz${i}`) * 60);
      m.receiveShadow = true;
      dunes.add(m);
    }
    local.add(dunes);
    const pyr = (x: number, z: number, h: number) => {
      const body = new THREE.ConeGeometry(h * 0.85, h, 4, 1).toNonIndexed();
      body.rotateY(Math.PI / 4);
      body.translate(0, h / 2, 0);
      const m = new THREE.Mesh(body, flat(col(P.pyramid)));
      m.position.set(x, LAND, z);
      m.castShadow = m.receiveShadow = true;
      const capH = h * 0.12;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.85 * 0.12, capH, 4, 1).toNonIndexed().rotateY(Math.PI / 4).translate(0, h - capH / 2 + 0.01, 0), flat(col(accent)));
      cap.position.copy(m.position);
      local.add(m, cap);
    };
    pyr(-6, -95, 8);
    pyr(5, -118, 10.5);
    pyr(-1, -150, 9);

    return {
      group,
      local,
      toWorld,
      landY: LAND,
      water,
      buildings,
      records: town.records,
      walk: [
        PLAZA,
        {x0: -12, x1: 12, z0: 2.35, z1: 2.65},
        {x0: -0.2, x1: 0.2, z0: -14, z1: 12},
      ],
      snow: [{x0: -70, x1: 70, z0: -280, z1: 30}],
      lot: LOT,
      pads: {x0: -2.7, x1: 3.3, z: -22, ok: () => true},
    };
  },
};
