// Moon Base: a cluster of white habitat domes and a landed rocket on a grey regolith plain, with
// solar panels, a comms dish, a rover on the path and the Earth hanging over the crater rim.
// Frame (yaw 0, camera at world z=12, 24 deg lens): local z = world z + 6; the visible ground
// starts near local z 10.7 and is only ~2.4 m wide there, so the bottom of the shot is the lit
// walkway, the rover and the edge of the hero dome on the right.
import {THREE, blocks, box, chamferBox, col, flat, frame, hill, instanced, isClear, mat4, pick, rand, sea, slab} from '../kit';
import type {Rect, SetPack} from '../kit';
import {P} from './palette';

type Item = {m: THREE.Matrix4; c: string};

const LAND = 0.24;
const BASE: Rect = {x0: -3.0, x1: 1.5, z0: 1.0, z1: 10.2};
const PATH: Rect = {x0: -0.3, x1: 0.3, z0: 1.2, z1: 10.6};
const DOME1 = {x: 1.2, z: 6.3, r: 0.92};
const DOME2 = {x: -1.45, z: 3.1, r: 0.78};
const DOME3 = {x: 0.1, z: 0.35, r: 1.02};
const MODULE = {x: -2.35, z: 5.6, w: 1.5, d: 0.95, h: 0.52};
const DISH = {x: -2.35, z: -5.4};
const SOLAR: Rect = {x0: -2.85, x1: -1.7, z0: -3.4, z1: 0.2};
const LANDER = {x: 1.85, z: -2.9};
const PAD = {x: 1.85, z: -2.9, r: 1.18};
const LOT = {x: -3.3, z: 7.4, hx: 0.7, hz: 0.45};
const EARTH = {x: -2.8, y: 4.3, z: -46, r: 2.2};
const CRATERS: {x: number; z: number; r: number}[] = [
  {x: -1.6, z: 9.4, r: 0.75},
  {x: 3.1, z: 8.6, r: 0.9},
  {x: -5.2, z: 6.2, r: 1.4},
  {x: 4.4, z: 1.4, r: 1.1},
  {x: -6.4, z: -4.4, r: 1.8},
  {x: 3.6, z: -9.4, r: 1.5},
  {x: -2.4, z: -12.6, r: 2.2},
  {x: 8.0, z: -16.0, r: 2.6},
];
const FAR_DOMES: [number, number, number][] = [[-9, -18, 1.3], [-6, -21, 1.0], [-11, -22, 1.6], [8, -20, 1.2], [11, -24, 1.5]];

export const pack: SetPack = {
  hero: {x: -1.2, z: -0.5, yaw: 0.14},
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
    const onBase = (x: number, z: number, pad = 0) => inRect(BASE, x, z, pad);
    const inDome = (x: number, z: number, pad = 0.2) => [DOME1, DOME2, DOME3].some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad);
    const onLot = (x: number, z: number) => server && Math.abs(x - LOT.x) < LOT.hx + 0.5 && Math.abs(z - LOT.z) < LOT.hz + 0.5;
    const free = (x: number, z: number) =>
      !onBase(x, z, 0.1) && !inDome(x, z, 0.35) && !inRect(SOLAR, x, z, 0.3) && !(Math.hypot(x - DISH.x, z - DISH.z) < 1.0) && !(Math.hypot(x - LANDER.x, z - LANDER.z) < PAD.r + 0.3) && !onLot(x, z) && ok(x, z, 0.4);

    const water = sea(P.water);
    water.position.y = LAND - 0.16;
    group.add(water);
    local.add(slab(-110, 110, -330, 50, -1, LAND, P.regolith));

    // ---- the base: a paved apron with a lit centre path, painted edge lines and marker posts
    local.add(slab(BASE.x0, BASE.x1, BASE.z0, BASE.z1, LAND, LAND + 0.01, P.regolithDark));
    local.add(slab(PATH.x0, PATH.x1, PATH.z0, PATH.z1, LAND, LAND + 0.02, P.dome));
    local.add(slab(PATH.x0 - 0.035, PATH.x0, PATH.z0, PATH.z1, LAND + 0.021, LAND + 0.026, accent));
    local.add(slab(PATH.x1, PATH.x1 + 0.035, PATH.z0, PATH.z1, LAND + 0.021, LAND + 0.026, accent));
    local.add(slab(BASE.x0, BASE.x0 + 0.06, BASE.z0, BASE.z1, LAND + 0.012, LAND + 0.02, P.trim));
    // the lander apron: a ring drawn in the dust, with a blast-scarred centre
    const apron = new THREE.Mesh(new THREE.RingGeometry(PAD.r * 0.55, PAD.r, 22).toNonIndexed(), flat(col(P.regolithLine)));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(PAD.x, LAND + 0.008, PAD.z);
    apron.receiveShadow = true;
    local.add(apron);
    local.add(slab(PAD.x - 0.62, PAD.x + 0.62, PAD.z - 0.62, PAD.z + 0.62, LAND, LAND + 0.014, P.regolithDark));

    const glows: Item[] = [];
    // ---- a habitat dome: hemisphere, a trim band, a door and warm window slits
    const dome = (x: number, z: number, r: number, doorAngle = 0) => {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), flat(col(P.dome)));
      shell.position.set(x, LAND, z);
      shell.castShadow = true;
      shell.receiveShadow = true;
      local.add(shell);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.02, 0.14, 14).toNonIndexed(), flat(col(P.trim)));
      band.position.set(x, LAND + 0.07, z);
      band.receiveShadow = true;
      local.add(band);
      // door and windows face the camera side (+z), the door turned toward the path
      const dx = Math.sin(doorAngle) * r * 0.98, dz = Math.cos(doorAngle) * r * 0.98;
      const door = mesh(chamferBox(0.26, 0.36, 0.06, 0.02), accent, x + dx, LAND, z + dz);
      door.rotation.y = doorAngle;
      local.add(door);
      for (const a of [-0.55, 0.55]) {
        const wx = Math.sin(doorAngle + a) * r * 0.94, wz = Math.cos(doorAngle + a) * r * 0.94;
        glows.push({m: mat4(x + wx, LAND + r * 0.42, z + wz, 0.15, 0.1, 0.05, doorAngle + a), c: P.window});
      }
      // a low entry step and two handrails
      local.add(slab(x + dx - 0.2, x + dx + 0.2, z + dz, z + dz + 0.22, LAND, LAND + 0.05, P.trim));
      // rooftop antenna
      local.add(mesh(box(0.02, 0.34, 0.02), P.trim, x - r * 0.2, LAND + r * 0.94, z - r * 0.15));
      glows.push({m: mat4(x - r * 0.2, LAND + r * 1.1, z - r * 0.15, 0.05, 0.05, 0.05, 0), c: accent});
    };
    dome(DOME1.x, DOME1.z, DOME1.r, -0.5);
    dome(DOME2.x, DOME2.z, DOME2.r, 0.7);
    dome(DOME3.x, DOME3.z, DOME3.r, 0.1);
    // connecting tubes: low cylinders between the domes, half sunk into the dust
    const tube = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.CylinderGeometry(0.17, 0.17, len, 8).toNonIndexed();
      g.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(g, flat(col(P.domeShade)));
      m.position.set((x0 + x1) / 2, LAND + 0.13, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      m.castShadow = true;
      m.receiveShadow = true;
      local.add(m);
    };
    tube(DOME1.x, DOME1.z, DOME3.x, DOME3.z);
    tube(DOME2.x, DOME2.z, DOME3.x, DOME3.z);
    tube(MODULE.x, MODULE.z, DOME2.x, DOME2.z);

    // ---- the habitat module: a long low box with ribbed ends and two lit slits
    local.add(mesh(chamferBox(MODULE.w, MODULE.h, MODULE.d, 0.03), P.domeShade, MODULE.x, LAND, MODULE.z));
    for (const rx of [-0.58, 0.58]) local.add(mesh(box(0.05, MODULE.h * 0.9, MODULE.d * 1.02), P.trim, MODULE.x + rx, LAND + 0.02, MODULE.z));
    glows.push({m: mat4(MODULE.x - 0.18, LAND + 0.3, MODULE.z + MODULE.d / 2 + 0.012, 0.3, 0.08, 0.02), c: P.window});
    glows.push({m: mat4(MODULE.x + 0.2, LAND + 0.3, MODULE.z + MODULE.d / 2 + 0.012, 0.3, 0.08, 0.02), c: P.window});

    // ---- solar array: four tilted panels on a frame
    const panels: Item[] = [];
    for (let i = 0; i < 4; i++) {
      const z = SOLAR.z0 + 0.35 + i * 0.72;
      panels.push({m: mat4(SOLAR.x0 + 0.8, LAND + 0.34, z, 1.15, 0.02, 0.5, -0.32), c: P.panel});
      local.add(mesh(box(0.03, 0.34, 0.03), P.mast, SOLAR.x0 + 0.3, LAND, z));
      local.add(mesh(box(0.03, 0.34, 0.03), P.mast, SOLAR.x0 + 1.3, LAND, z));
      local.add(mesh(box(1.2, 0.02, 0.03), P.panelEdge, SOLAR.x0 + 0.8, LAND + 0.36, z - 0.26));
    }
    local.add(instanced(box(1, 1, 1), panels, false));

    // ---- the comms dish on its mast
    local.add(mesh(box(0.05, 0.9, 0.05), P.mast, DISH.x, LAND, DISH.z));
    local.add(mesh(box(0.4, 0.04, 0.04), P.mast, DISH.x + 0.16, LAND + 0.7, DISH.z));
    const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.2, 12, 1, true).toNonIndexed(), flat(col(P.dome)));
    bowl.position.set(DISH.x, LAND + 1.02, DISH.z);
    bowl.rotation.x = Math.PI + 0.55;
    bowl.castShadow = true;
    local.add(bowl);
    glows.push({m: mat4(DISH.x, LAND + 0.92, DISH.z + 0.02, 0.03, 0.03, 0.03, 0), c: accent});

    // ---- the lander: a squat ascent stage on four legs, accent trim, sitting on the pad
    const lander = new THREE.Group();
    lander.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 8).toNonIndexed(), P.dome, 0, LAND + 0.42, 0));
    lander.add(mesh(new THREE.ConeGeometry(0.3, 0.3, 8).toNonIndexed(), P.trim, 0, LAND + 0.82, 0));
    lander.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6).toNonIndexed(), accent, 0, LAND + 1.05, 0));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = mesh(box(0.045, 0.62, 0.045), P.mast, dx * 0.38, LAND, dz * 0.38);
      leg.rotation.z = dx * 0.28;
      leg.rotation.x = -dz * 0.28;
      lander.add(leg);
      lander.add(mesh(box(0.16, 0.03, 0.16), P.trim, dx * 0.5, LAND + 0.02, dz * 0.5));
    }
    lander.add(mesh(box(0.26, 0.12, 0.02), P.window, 0, LAND + 0.5, 0.31));
    lander.position.set(LANDER.x, 0, LANDER.z);
    local.add(lander);

    // ---- the rover: a small six-wheeled cart with a dish, parked beside the path
    const rover = new THREE.Group();
    rover.add(mesh(chamferBox(0.34, 0.12, 0.18, 0.02), P.dome, 0, LAND + 0.12, 0));
    rover.add(mesh(box(0.2, 0.05, 0.14), P.panel, 0, LAND + 0.2, 0));
    rover.add(mesh(box(0.02, 0.16, 0.02), P.mast, -0.1, LAND + 0.22, 0));
    rover.add(mesh(new THREE.ConeGeometry(0.06, 0.05, 8).toNonIndexed(), P.dome, -0.1, LAND + 0.4, 0));
    for (const wx of [-0.12, 0, 0.12]) for (const wz of [-0.1, 0.1]) {
      const w = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8).toNonIndexed(), P.trim, wx, LAND + 0.06, wz);
      w.rotation.x = Math.PI / 2;
      rover.add(w);
    }
    rover.position.set(0.62, 0, 8.3);
    rover.rotation.y = 0.5;
    local.add(rover);

    // ---- marker posts along the path, each with an accent cap
    const posts: Item[] = [];
    for (const z of [2.6, 4.2, 5.8, 7.4, 9.0]) {
      posts.push({m: mat4(-0.42, LAND, z, 0.03, 0.3, 0.03), c: P.trim});
      posts.push({m: mat4(0.42, LAND, z, 0.03, 0.3, 0.03), c: P.trim});
      glows.push({m: mat4(-0.42, LAND + 0.32, z, 0.04, 0.04, 0.04), c: accent});
      glows.push({m: mat4(0.42, LAND + 0.32, z, 0.04, 0.04, 0.04), c: accent});
    }
    local.add(instanced(box(1, 1, 1), posts));

    // ---- storage modules behind the base: the towers act grows these
    const rowL = blocks(seed, 'store', {x0: -5.6, x1: -3.7, z0: -6.4, z1: -0.6}, LAND, [P.domeShade, P.dome], {cell: 0.95, gap: 0.18, hMin: 0.32, hMax: 0.55, ok: free});
    const rowR = blocks(seed, 'store2', {x0: 3.4, x1: 6.2, z0: -8.0, z1: -1.0}, LAND, [P.domeShade, P.dome], {cell: 1.05, gap: 0.2, hMin: 0.3, hMax: 0.5, ok: free});
    const rows = [rowL, rowR];
    const buildings = instanced(chamferBox(1, 1, 1, 0.02), rows.flatMap((r) => r.items));
    local.add(buildings);
    const records = rows.flatMap((r) => r.records);
    for (const b of records) {
      // every module gets a ribbed lid and a lit slit, so a grown one still reads as a module
      local.add(mesh(box(b.w * 1.02, 0.03, b.d * 1.02), P.trim, b.x, LAND + b.h, b.z));
      glows.push({m: mat4(b.x, LAND + b.h * 0.6, b.z + b.d / 2 + 0.012, b.w * 0.4, 0.04, 0.02), c: P.window});
    }

    // ---- regolith detail: crater rims, scattered rocks and the far dome cluster
    for (const c of CRATERS) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, c.r * 0.09, 4, 18).toNonIndexed(), flat(col(P.regolithDark)));
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(c.x, LAND + 0.015, c.z);
      rim.receiveShadow = true;
      local.add(rim);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.97, 18).toNonIndexed(), flat(col(P.regolithLine)));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(c.x, LAND + 0.01, c.z);
      floor.receiveShadow = true;
      local.add(floor);
    }
    const rocks: Item[] = [];
    for (let i = 0; i < 90; i++) {
      const x = -14 + rand(seed, `rx${i}`) * 28, z = -26 + rand(seed, `rz${i}`) * 34;
      if (onBase(x, z, 0.6) || inDome(x, z, 0.5) || Math.hypot(x - LANDER.x, z - LANDER.z) < PAD.r + 0.4) continue;
      const s = 0.05 + rand(seed, `rs${i}`) * 0.14;
      rocks.push({m: mat4(x, LAND + s * 0.3, z, s, s * 0.7, s, rand(seed, `rr${i}`) * Math.PI), c: pick(seed, `rc${i}`, P.rock)});
    }
    local.add(instanced(new THREE.IcosahedronGeometry(1, 0), rocks));
    for (let i = 0; i < FAR_DOMES.length; i++) {
      const [x, z, r] = FAR_DOMES[i];
      const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), flat(col(P.dome)));
      shell.position.set(x, LAND, z);
      shell.receiveShadow = true;
      local.add(shell);
    }
    // a low crater rim on the horizon, then the Earth over it
    for (let i = 0; i < 5; i++) {
      const g = hill(seed, `rim${i}`, 16 + rand(seed, `rr${i}`) * 10, 1.4 + rand(seed, `rh${i}`) * 1.2, 8);
      local.add(mesh(g, i % 2 ? P.regolithDark : P.regolithLine, -60 + i * 30, LAND - 0.3, -95 - rand(seed, `rd${i}`) * 30));
    }
    const earth = new THREE.Group();
    earth.add(mesh(new THREE.IcosahedronGeometry(EARTH.r, 2).toNonIndexed(), P.earth, EARTH.x, EARTH.y, EARTH.z));
    for (let i = 0; i < 5; i++) {
      const a = rand(seed, `ea${i}`) * Math.PI * 2, b = 0.3 + rand(seed, `eb${i}`) * 1.2;
      const patch = new THREE.Mesh(new THREE.IcosahedronGeometry(EARTH.r * (0.3 + rand(seed, `ec${i}`) * 0.2), 0).toNonIndexed(), flat(col(i % 2 ? P.earthCloud : P.earthLand)));
      patch.position.set(EARTH.x + Math.cos(a) * Math.cos(b) * EARTH.r * 0.86, EARTH.y + Math.sin(b) * EARTH.r * 0.86, EARTH.z + Math.sin(a) * Math.cos(b) * EARTH.r * 0.4);
      patch.scale.set(1, 0.55, 0.35);
      earth.add(patch);
    }
    group.add(earth);

    if (glows.length) local.add(instanced(box(1, 1, 1), glows, false));

    // a small power hut on the pad side: the blackout act lights this up and switches it off
    if (server) local.add(mesh(chamferBox(LOT.hx * 2, 0.4, LOT.hz * 2, 0.02), P.sign, LOT.x, LAND, LOT.z));

    const pads = {
      x0: -3.4,
      x1: 3.4,
      z: -30,
      ok: (w: THREE.Vector3) => {
        const x = w.x, z = w.z + 6;
        if (z > -26 || z < -36) return false;
        if (Math.abs(x) < 0.9) return false;
        if (Math.hypot(x - LANDER.x, z - LANDER.z) < PAD.r + 0.6) return false;
        if (records.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35)) return false;
        if (CRATERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.4)) return false;
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
      walk: [PATH, BASE, {x0: PAD.x - PAD.r, x1: PAD.x + PAD.r, z0: PAD.z - PAD.r, z1: PAD.z + PAD.r}],
      snow: [{x0: -110, x1: 110, z0: -330, z1: 50}],
      lot: LOT,
      pads,
    };
  },
};
