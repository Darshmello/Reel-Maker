// The hero figure: Darsh at a desk on the park lawn. A low-poly figurine about 1 m tall (a giant
// among the 0.3 m cars, on purpose): messy dark curls, round tortoiseshell glasses, moustache and
// goatee, black tee with its white print. Faces +z; base at y=0. Pose is a pure function of numbers
// handed in per frame, so every frame is reproducible.
import * as THREE from 'three';
import {PALETTE, col} from './palette';
import {box, chamferBox, flat} from './props';

export type Pose = {
  phone: number; // 1 = phone up in both hands, 0 = put away in the desk
  lid: number; // laptop lid 0 closed .. 1 open
  type: number; // typing amount 0..1
  t: number; // world frame, for the small cyclic motions
};

const mesh = (g: THREE.BufferGeometry, c: string, shadow = true) => {
  const m = new THREE.Mesh(g, flat(col(c)));
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
const at = (m: THREE.Object3D, x: number, y: number, z: number) => {
  m.position.set(x, y, z);
  return m;
};

export const makeDarsh = () => {
  const g = new THREE.Group();

  // stool, legs, shoes
  g.add(at(mesh(chamferBox(0.26, 0.27, 0.24, 0.02), PALETTE.sidewalk), 0, 0, -0.03));
  for (const s of [-1, 1]) {
    g.add(at(mesh(box(0.1, 0.09, 0.27), PALETTE.jeans), s * 0.065, 0.27, 0.1));
    g.add(at(mesh(box(0.085, 0.27, 0.09), PALETTE.jeans), s * 0.065, 0.02, 0.22));
    g.add(at(mesh(box(0.09, 0.045, 0.14), PALETTE.shoes), s * 0.065, 0, 0.25));
  }

  // torso, print, neck
  const torso = new THREE.Group();
  torso.add(at(mesh(chamferBox(0.3, 0.34, 0.17, 0.035), PALETTE.shirt), 0, 0, 0));
  const print = at(mesh(box(0.17, 0.02, 0.004), PALETTE.shirtPrint, false), 0, 0.12, 0.086);
  print.rotation.z = -0.14;
  torso.add(print);
  torso.add(at(mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.07, 5).toNonIndexed(), PALETTE.skin), 0, 0.37, 0));
  at(torso, 0, 0.3, -0.03);
  g.add(torso);

  // head: pivot at the neck so it can look down at the phone or at the laptop
  const head = new THREE.Group();
  at(head, 0, 0.4, 0);
  torso.add(head);
  const skull = new THREE.IcosahedronGeometry(0.115, 1);
  skull.scale(0.92, 1.1, 1);
  head.add(at(mesh(skull, PALETTE.skin), 0, 0.12, 0));
  head.add(at(mesh(box(0.028, 0.042, 0.03), PALETTE.skin), 0, 0.09, 0.1));
  for (const s of [-1, 1]) head.add(at(mesh(box(0.02, 0.045, 0.035), PALETTE.skin), s * 0.104, 0.1, 0));
  head.add(at(mesh(box(0.08, 0.014, 0.012), PALETTE.hair), 0, 0.072, 0.103)); // moustache
  head.add(at(mesh(box(0.045, 0.045, 0.02), PALETTE.hair), 0, 0.0, 0.088)); // goatee
  for (const s of [-1, 1]) {
    head.add(at(mesh(box(0.022, 0.012, 0.006), PALETTE.hair, false), s * 0.045, 0.128, 0.104)); // eyes
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0075, 4, 10), flat(col(PALETTE.frames)));
    head.add(at(ring, s * 0.046, 0.13, 0.113));
    head.add(at(mesh(box(0.008, 0.008, 0.11), PALETTE.frames, false), s * 0.086, 0.13, 0.06)); // temples
  }
  head.add(at(mesh(box(0.022, 0.008, 0.008), PALETTE.frames, false), 0, 0.136, 0.115));
  // curls: clustered icospheres, volume on top, a fringe falling forward
  const curls: [number, number, number, number][] = [
    [0, 0.235, 0, 0.078], [0.062, 0.225, 0.028, 0.062], [-0.062, 0.222, 0.018, 0.064], [0, 0.215, 0.07, 0.06],
    [-0.042, 0.19, 0.092, 0.05], [0.05, 0.195, 0.082, 0.046], [0.092, 0.165, -0.02, 0.056], [-0.092, 0.165, -0.02, 0.056],
    [0, 0.175, -0.082, 0.072], [0.07, 0.125, -0.062, 0.052], [-0.07, 0.125, -0.062, 0.052], [0.103, 0.105, -0.005, 0.034],
    [-0.103, 0.105, -0.005, 0.034], [0.03, 0.26, -0.04, 0.055], [-0.03, 0.255, 0.045, 0.05],
  ];
  curls.forEach(([x, y, z, r], i) => {
    const c = mesh(new THREE.IcosahedronGeometry(r, 0), PALETTE.hair);
    c.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    head.add(at(c, x, y, z));
  });

  // arms: shoulder -> upper arm (sleeve + skin) -> elbow -> forearm + hand, built hanging down
  const arms = [-1, 1].map((s) => {
    const shoulder = at(new THREE.Group(), s * 0.165, 0.29, 0);
    torso.add(shoulder);
    shoulder.add(at(mesh(box(0.085, 0.13, 0.085), PALETTE.shirt), 0, -0.12, 0));
    shoulder.add(at(mesh(box(0.06, 0.11, 0.06), PALETTE.skin), 0, -0.22, 0));
    const elbow = at(new THREE.Group(), 0, -0.21, 0);
    shoulder.add(elbow);
    elbow.add(at(mesh(box(0.055, 0.19, 0.055), PALETTE.skin), 0, -0.19, 0));
    elbow.add(at(mesh(box(0.06, 0.07, 0.035), PALETTE.skin), 0, -0.25, 0));
    return {s, shoulder, elbow};
  });

  // desk, laptop, phone
  const deskZ = 0.38, top = 0.37;
  g.add(at(mesh(chamferBox(0.52, 0.025, 0.3, 0.008), PALETTE.desk), 0, top, deskZ));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(box(0.025, top, 0.025), PALETTE.desk), sx * 0.23, 0, deskZ + sz * 0.12));
  g.add(at(mesh(box(0.25, 0.012, 0.17), PALETTE.laptop), 0, top + 0.025, deskZ - 0.01));
  const lid = at(new THREE.Group(), 0, top + 0.037, deskZ + 0.075);
  lid.add(at(mesh(box(0.25, 0.165, 0.008), PALETTE.laptop), 0, 0, 0));
  lid.add(at(mesh(box(0.22, 0.135, 0.002), PALETTE.screen, false), 0, 0.015, -0.005));
  g.add(lid);
  const phone = new THREE.Group();
  phone.add(mesh(box(0.05, 0.09, 0.009), PALETTE.phone));
  phone.add(at(mesh(box(0.042, 0.078, 0.002), PALETTE.screen, false), 0, 0.006, -0.005));
  g.add(phone);

  const lerp = THREE.MathUtils.lerp;
  const pose = ({phone: p, lid: l, type, t}: Pose) => {
    // head: down at the phone, up at the screen; a slow bob either way
    head.rotation.x = lerp(0.14, 0.5, p) + Math.sin(t * 0.09) * 0.03;
    head.rotation.y = lerp(0, 0.05, p) + Math.sin(t * 0.05) * 0.04 * (1 - p);
    torso.rotation.x = lerp(0.03, 0.1, p);
    torso.scale.y = 1 + Math.sin(t * 0.21) * 0.008;
    for (const {s, shoulder, elbow} of arms) {
      const tap = type * Math.max(0, Math.sin(t * 1.9 + (s > 0 ? 0 : 1.7))) * 0.09;
      shoulder.rotation.x = lerp(-0.42, -0.62, p);
      shoulder.rotation.z = s * lerp(0.08, 0.3, p);
      elbow.rotation.x = lerp(-1.18, -1.95, p) + tap;
      elbow.rotation.z = -s * lerp(0.12, 0.35, p);
    }
    // laptop lid: closed lies toward Darsh; open leans a little toward camera
    lid.rotation.x = lerp(-Math.PI / 2 + 0.02, 0.22, l);
    // phone: in both hands at chest height, then slides into the desk drawer
    const scroll = Math.sin(t * 0.6) * 0.004 * p;
    phone.position.set(0, lerp(top - 0.03, 0.66 + scroll, p), lerp(deskZ - 0.08, 0.19, p));
    phone.rotation.x = lerp(-Math.PI / 2, -0.75, p);
    const vis = Math.min(1, p * 6);
    phone.scale.setScalar(Math.max(0.001, vis));
  };
  pose({phone: 1, lid: 0, type: 0, t: 0});
  return {group: g, pose};
};
