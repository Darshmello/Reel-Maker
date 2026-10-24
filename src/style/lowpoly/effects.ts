// The act library. Each act changes exactly one thing in the set; every value is a function of the
// world frame `e` and the act's cue-derived frames from beats.ts, so frames are reproducible.
import * as THREE from 'three';
import {random} from 'remotion';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Act, Beats} from '../../film/beats';
import {PALETTE, col} from './palette';
import type {SetBuild} from '../../sets/types';
import {box, chamferBox, flat, mat4} from './props';

export type Effect = {update: (e: number, cam: THREE.Vector3) => void};
type Ctx = {city: SetBuild; beats: Beats; seed: string; accent: string; scene: THREE.Scene};

const smooth = (t: number) => t * t * (3 - 2 * t);
const outBack = (t: number) => {
  const c = 1.4, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
const c01 = (x: number) => Math.min(1, Math.max(0, x));

// non-indexed, no uvs: so any of our primitives can be merged together
const plain = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  return n;
};

// Instanced meshes here move their instances every frame; never cull them on a stale bounding sphere.
const live = <T extends THREE.Object3D>(o: T) => {
  o.traverse((c) => (c.frustumCulled = false));
  return o;
};

const basic = (c: string, opts: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({color: col(c), fog: true, ...opts});

// A cumulative level across a film's acts of one kind: each act eases the level to its amount.
export const level = (e: number, acts: Act[], beats: Beats, base = 0) => {
  let v = base;
  for (const a of acts) v = THREE.MathUtils.lerp(v, a.amount ?? 0, smooth(beats.prog(e, a)));
  return v;
};

// ---------------------------------------------------------------- towers: the city builds itself
const towers = (acts: Act[], {city, seed}: Ctx): Effect => {
  const {records, buildings} = city;
  if (!buildings) return {update: () => {}};
  const cam = new THREE.PerspectiveCamera(24, 1080 / 1920, 0.1, 400);
  const grow: {idx: number; at: number; k: number}[] = [];
  const taken = new Set<number>();
  for (const a of acts) {
    // pick buildings that sit inside the frame at this act's end camera
    cam.position.set(a.cam.x, 3.4, a.cam.z);
    cam.rotation.set(THREE.MathUtils.degToRad(-10), 0, 0);
    cam.updateMatrixWorld(true);
    const near: {idx: number; score: number}[] = [], far: {idx: number; score: number}[] = [];
    records.forEach((b, idx) => {
      if (taken.has(idx)) return;
      const p = city.toWorld(b.x, b.z).setY(city.landY + b.h).project(cam);
      if (Math.abs(p.x) > 0.92 || p.z > 1 || p.y < -0.3 || p.y > 0.95) return;
      (b.far ? far : near).push({idx, score: random(`${seed}:tw${idx}`)});
    });
    near.sort((x, y) => x.score - y.score);
    far.sort((x, y) => x.score - y.score);
    // most of the growth is the skyline shooting up; a few mid-ground blocks rise too
    const nNear = Math.round(a.schedule.length * 0.25);
    const picks = [...near.slice(0, nNear).map((c) => ({...c, k: 1.2 + random(`${seed}:tk${c.idx}`) * 1.3})), ...far.slice(0, a.schedule.length - nNear).map((c) => ({...c, k: 2.5 + random(`${seed}:tk${c.idx}`) * 4.5}))];
    picks.sort((x, y) => x.score - y.score);
    a.schedule.forEach((at, j) => {
      const c = picks[j];
      if (!c) return;
      taken.add(c.idx);
      grow.push({idx: c.idx, at, k: c.k});
    });
  }
  const m = new THREE.Matrix4();
  return {
    update: (e) => {
      for (const g of grow) {
        const b = records[g.idx];
        const t = c01((e - g.at) / 40);
        const h = b.h * (1 + g.k * (t > 0 ? outBack(t) : 0));
        buildings.setMatrixAt(g.idx, m.copy(mat4(b.x, city.landY, b.z, b.w, h, b.d)));
      }
      buildings.instanceMatrix.needsUpdate = true;
    },
  };
};

// ------------------------------------------------------- blackout: a server farm goes dark
const signTexture = (lit: boolean) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = PALETTE.server;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = lit ? PALETTE.serverLight : PALETTE.serverOff;
  g.font = 'bold 88px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('18+', 128, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const blackout = (acts: Act[], {city, seed}: Ctx): Effect => {
  const L = city.lot, land = city.landY;
  const W = L.hx * 2 - 0.1, D = L.hz * 2 - 0.08, H = 0.62;
  const farm = new THREE.Group();
  const body = new THREE.Mesh(chamferBox(W, H, D, 0.03), flat(col(PALETTE.server)));
  body.castShadow = body.receiveShadow = true;
  farm.add(body);
  // rooftop units
  const units = new THREE.Mesh(mergeGeometries([-0.45, -0.15, 0.15, 0.45].map((x) => box(0.2, 0.08, 0.2, x * W * 0.9, H, 0.12))), flat(col(PALETTE.sidewalk)));
  units.castShadow = true;
  farm.add(units);
  // sign on a frame above the roof, facing the camera side (local -z)
  const signOn = new THREE.MeshBasicMaterial({map: signTexture(true)});
  const signOff = new THREE.MeshBasicMaterial({map: signTexture(false)});
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), signOn);
  sign.position.set(-0.25, H + 0.24, -0.1);
  sign.rotation.y = Math.PI;
  const post = new THREE.Mesh(mergeGeometries([box(0.03, 0.12, 0.03, -0.42, H, -0.09), box(0.03, 0.12, 0.03, -0.08, H, -0.09)]), flat(col(PALETTE.asphalt)));
  farm.add(sign, post);
  // light strips on the two faces the camera sees
  const lights: THREE.Matrix4[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) lights.push(mat4(-W / 2 + 0.16 + c * ((W - 0.32) / 5), 0.15 + r * 0.16, -D / 2 - 0.006, 0.15, 0.075, 0.01));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) lights.push(mat4(W / 2 + 0.006, 0.15 + r * 0.16, -D / 4 + c * (D / 2), 0.01, 0.075, 0.15));
  const lg = box(1, 1, 1);
  lg.translate(0, -0.5, 0);
  const lamp = new THREE.InstancedMesh(lg, basic(PALETTE.serverLight), lights.length);
  lights.forEach((m, i) => lamp.setMatrixAt(i, m));
  farm.add(lamp);
  farm.position.set(L.x, land, L.z);
  city.local.add(live(farm));

  const act = acts[0];
  // seeded order in which lights go out
  const order = lights.map((_, i) => i).sort((a, b) => random(`${seed}:lo${a}`) - random(`${seed}:lo${b}`));
  const offAt = new Array(lights.length).fill(Infinity);
  order.forEach((li, j) => (offAt[li] = act.schedule[j] ?? act.fxEnd));
  const on = col(PALETTE.serverLight), dim = col(PALETTE.cloud), off = col(PALETTE.serverOff);
  const powerDown = act.schedule[act.schedule.length - 1] + 10;
  return {
    update: (e) => {
      lights.forEach((_, i) => {
        const blink = random(`${seed}:bl${i}:${Math.floor(e / 5)}`) < 0.18;
        lamp.setColorAt(i, e >= offAt[i] ? off : blink ? dim : on);
      });
      lamp.instanceColor!.needsUpdate = true;
      sign.material = e >= powerDown ? signOff : signOn;
    },
  };
};

// ------------------------------------------------------- rockets: pads in the bay, launches
const rockets = (acts: Act[], {city, seed, accent}: Ctx): Effect => {
  const act = acts[0];
  const n = act.schedule.length;
  // pads in world space in the set's pad band; spots the set rejects are skipped
  const pads: THREE.Vector3[] = [];
  const B = city.pads, step = (B.x1 - B.x0) / 3;
  for (let i = 0; pads.length < n && i < n * 4; i++) {
    const row = Math.floor(i / 4), c = i % 4;
    const v = new THREE.Vector3(B.x0 + c * step + (row % 2) * 0.45 * step + (random(`${seed}:px${i}`) - 0.5) * 0.5, 0, B.z - row * 4.2 - (random(`${seed}:pz${i}`) - 0.5) * 1.2);
    if (B.ok(v)) pads.push(v);
  }
  const padGeo = mergeGeometries([plain(new THREE.CylinderGeometry(0.34, 0.38, 0.5, 8)).translate(0, -0.2, 0)]);
  const padMesh = new THREE.InstancedMesh(padGeo, flat(col(PALETTE.pad)), n);
  const ringMesh = new THREE.InstancedMesh(plain(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 8)).translate(0, 0.056, 0), flat(col(PALETTE.asphalt)), n);
  const bodyGeo = mergeGeometries([plain(new THREE.CylinderGeometry(0.055, 0.06, 0.6, 6)).translate(0, 0.3, 0), (() => {
    const fins = [0, 1, 2].map((k) => box(0.012, 0.12, 0.09, 0, 0, 0.07).rotateY((k * Math.PI * 2) / 3));
    return mergeGeometries(fins);
  })()]);
  const body = new THREE.InstancedMesh(bodyGeo, flat(col(PALETTE.rocket)), n);
  const nose = new THREE.InstancedMesh(plain(new THREE.ConeGeometry(0.058, 0.17, 6)).translate(0, 0.685, 0), flat(col(accent)), n);
  const flame = new THREE.InstancedMesh(plain(new THREE.ConeGeometry(0.05, 0.22, 6)).rotateX(Math.PI).translate(0, -0.11, 0), basic(PALETTE.flame), n);
  for (const m of [padMesh, ringMesh, body, nose]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  const P = 46, G = 7; // trail puffs and ground puffs per rocket
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), flat(col(PALETTE.smoke)), n * (P + G));
  const grp = new THREE.Group();
  grp.add(padMesh, ringMesh, body, nose, flame, puffs);
  city.group.add(live(grp));

  const A = 3.2 / 900; // m per frame^2 (3.2 m/s^2)
  const alt = (age: number) => (age <= 0 ? 0 : 0.5 * A * age * age);
  const m = new THREE.Matrix4();
  const hide = mat4(0, -50, 0, 0.0001, 0.0001, 0.0001);
  return {
    update: (e) => {
      const rise = smooth(c01((e - act.fxStart) / 20)); // pads and rockets come up out of the bay
      const padY = THREE.MathUtils.lerp(-0.7, 0, rise);
      pads.forEach((p, i) => {
        const L0 = act.schedule[i];
        const age = e - L0;
        const shown = e >= act.fxStart;
        padMesh.setMatrixAt(i, shown ? mat4(p.x, padY, p.z) : hide);
        ringMesh.setMatrixAt(i, shown ? mat4(p.x, padY, p.z) : hide);
        const y = padY + 0.06 + alt(age);
        const rm = shown && y < 40 ? mat4(p.x, y, p.z, 1, 1, 1, i) : hide;
        body.setMatrixAt(i, rm);
        nose.setMatrixAt(i, rm);
        const fl = 0.8 + random(`${seed}:fl${i}:${e}`) * 0.5;
        flame.setMatrixAt(i, shown && age > 0 && y < 40 ? mat4(p.x, y, p.z, 1, fl * Math.min(1, age / 6), 1) : hide);
        for (let k = 0; k < P; k++) {
          const te = L0 + k * 2;
          const pa = e - te;
          const idx = i * (P + G) + k;
          if (!shown || pa < 0) {
            puffs.setMatrixAt(idx, hide);
            continue;
          }
          const jx = (random(`${seed}:jx${i}:${k}`) - 0.5) * 0.08, jz = (random(`${seed}:jz${i}:${k}`) - 0.5) * 0.08;
          const s = 0.06 + 0.22 * (1 - Math.exp(-pa / 30)) + k * 0.002;
          puffs.setMatrixAt(idx, m.copy(mat4(p.x + jx, padY + 0.02 + alt(te - L0), p.z + jz, s, s, s, k)));
        }
        for (let k = 0; k < G; k++) {
          const idx = i * (P + G) + P + k;
          if (!shown || age < 0) {
            puffs.setMatrixAt(idx, hide);
            continue;
          }
          const ang = (k / G) * Math.PI * 2 + i;
          const rr = 0.15 + 0.35 * (1 - Math.exp(-age / 20));
          const s = 0.1 + 0.16 * (1 - Math.exp(-age / 25));
          puffs.setMatrixAt(idx, m.copy(mat4(p.x + Math.cos(ang) * rr, padY + 0.08, p.z + Math.sin(ang) * rr, s, s * 0.7, s, k)));
        }
      });
      for (const im of [padMesh, ringMesh, body, nose, flame, puffs]) im.instanceMatrix.needsUpdate = true;
    },
  };
};

// ------------------------------------------------------- crowd: people fill the city
const personGeo = () => {
  const b = box(0.034, 0.07, 0.024);
  const h = new THREE.IcosahedronGeometry(0.017, 0).toNonIndexed();
  h.deleteAttribute('uv');
  h.translate(0, 0.088, 0);
  return mergeGeometries([b, h]);
};

const crowd = (acts: Act[], {city, beats, seed}: Ctx): Effect => {
  const N = Math.max(...acts.map((a) => a.amount ?? 0));
  // fill order: the park, then streets and the bridge, then rooftops and promenades
  const pts: {x: number; y: number; z: number}[] = [];
  const W = city.walk.length;
  const inRect = (rIdx: number, i: number) => {
    const R = city.walk[rIdx % W];
    return {x: THREE.MathUtils.lerp(R.x0, R.x1, random(`${seed}:cx${rIdx}:${i}`)), y: R.y ?? city.landY, z: THREE.MathUtils.lerp(R.z0, R.z1, random(`${seed}:cz${rIdx}:${i}`))};
  };
  const first = Math.round(N * 0.14), second = Math.round(N * 0.3);
  for (let i = 0; i < first; i++) pts.push(inRect(0, i));
  const area = (W > 1 ? city.walk.slice(1, 6) : city.walk).map((R) => Math.abs((R.x1 - R.x0) * (R.z1 - R.z0)));
  const tot = area.reduce((a, b) => a + b, 0);
  for (let i = 0; i < second; i++) {
    let u = random(`${seed}:cr${i}`) * tot, k = 0;
    while (k < area.length - 1 && u > area[k]) u -= area[k++];
    pts.push(inRect(W > 1 ? k + 1 : 0, i));
  }
  const roofs = city.records.map((b, idx) => ({b, idx})).filter(({b}) => !b.far && Math.abs(b.z) < 14 && Math.abs(b.x) < 9);
  for (let i = pts.length; i < N; i++) {
    if (i % 5 === 0 || !roofs.length) {
      pts.push(inRect(W > 6 ? 6 + (i % 2) : i % W, i));
      continue;
    }
    const {b} = roofs[Math.floor(random(`${seed}:rf${i}`) * roofs.length)];
    pts.push({x: b.x + (random(`${seed}:rx${i}`) - 0.5) * (b.w - 0.08), y: city.landY + b.h, z: b.z + (random(`${seed}:rz${i}`) - 0.5) * (b.d - 0.08)});
  }
  const mesh = new THREE.InstancedMesh(personGeo(), flat(), N);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pts.forEach((_, i) => mesh.setColorAt(i, col(PALETTE.people[Math.floor(random(`${seed}:pc${i}`) * PALETTE.people.length)])));
  city.local.add(live(mesh));
  const hide = mat4(0, -50, 0, 0.0001, 0.0001, 0.0001);
  return {
    update: (e) => {
      const count = level(e, acts, beats);
      pts.forEach((p, i) => {
        const pop = c01(count - i); // each person pops in as the count passes them
        const bob = Math.max(0, Math.sin(e * 0.35 + i * 1.7)) * 0.006;
        mesh.setMatrixAt(i, pop > 0 ? mat4(p.x, p.y + bob, p.z, pop, pop, pop, i) : hide);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
};

// ------------------------------------------------------- weather particles (snow, rain)
const particles = (n: number, geo: THREE.BufferGeometry, mat: THREE.Material, seed: string, speed: number, sway: number) => {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const H = 6;
  const seeds = Array.from({length: n}, (_, i) => ({x: random(`${seed}:wx${i}`), z: random(`${seed}:wz${i}`), y: random(`${seed}:wy${i}`), s: 0.7 + random(`${seed}:ws${i}`) * 0.6}));
  const hide = mat4(0, -50, 0, 0.0001, 0.0001, 0.0001);
  const update = (e: number, cam: THREE.Vector3, amount: number) => {
    seeds.forEach((q, i) => {
      if (i / n >= amount) {
        mesh.setMatrixAt(i, hide);
        return;
      }
      const z = cam.z - 3 - q.z * 22;
      const spread = (cam.z - z) * 0.32;
      const x = cam.x + (q.x - 0.5) * 2 * spread + Math.sin(e * 0.05 + i) * sway;
      const y = H - (((q.y * H + e * speed * q.s) % H) + H) % H;
      mesh.setMatrixAt(i, mat4(x, y, z, 1, 1, 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return {mesh, update};
};

const snow = (acts: Act[], {city, beats, seed, scene}: Ctx): Effect => {
  const flakes = particles(1600, new THREE.OctahedronGeometry(0.02, 0), basic(PALETTE.snow), seed, 0.03, 0.08);
  scene.add(live(flakes.mesh));
  // cover: translucent white over the land tops and the roofs
  const mat = new THREE.MeshLambertMaterial({color: col(PALETTE.snow), flatShading: true, transparent: true, opacity: 0, depthWrite: false});
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  const cover = new THREE.Group();
  for (const {x0, x1, z0, z1} of city.snow) {
    const m = land.clone();
    m.scale.set(x1 - x0, 1, z1 - z0);
    m.position.set((x0 + x1) / 2, city.landY + 0.004, (z0 + z1) / 2);
    cover.add(m);
  }
  const caps = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, Math.max(1, city.records.length));
  caps.count = city.records.length;
  city.records.forEach((b, i) => caps.setMatrixAt(i, mat4(b.x, city.landY + b.h + 0.004, b.z, b.w, 1, b.d)));
  cover.add(caps);
  city.local.add(live(cover));
  return {
    update: (e, cam) => {
      const a = acts.find((x) => e >= x.start - 10 && e < x.end + 10);
      flakes.update(e, cam, a ? c01((e - a.start + 10) / 20) : 0);
      mat.opacity = 0.88 * level(e, acts, beats);
    },
  };
};

const rain = (acts: Act[], {seed, scene}: Ctx): Effect => {
  const streak = box(0.005, 0.24, 0.005);
  const drops = particles(1800, streak, basic(PALETTE.rain, {transparent: true, opacity: 0.6}), seed, 0.42, 0);
  scene.add(live(drops.mesh));
  return {
    update: (e, cam) => {
      const a = acts.find((x) => e >= x.start - 10 && e < x.end + 10);
      drops.update(e, cam, a ? c01((e - a.start + 10) / 20) : 0);
    },
  };
};

const BUILDERS = {towers, blackout, rockets, crowd, snow, rain} as const;

export const makeEffects = (ctx: Ctx): Effect[] => {
  const kinds = [...new Set(ctx.beats.acts.map((a) => a.kind))];
  return kinds.filter((k): k is keyof typeof BUILDERS => k in BUILDERS).map((k) => BUILDERS[k](ctx.beats.acts.filter((a) => a.kind === k), ctx));
};

// water level in metres above the bay at world frame e (water and rain acts)
export const waterLevel = (e: number, beats: Beats) => level(e, beats.acts.filter((a) => a.kind === 'water' || a.kind === 'rain'), beats);
