// Low-poly prop geometry. Everything flat-shaded Lambert; geometry is built at unit-ish size and
// placed through instance matrices.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {PALETTE, col} from './palette';

export const flat = (color: THREE.ColorRepresentation = 0xffffff) =>
  new THREE.MeshLambertMaterial({color, flatShading: true});

// A box with a one-segment chamfer, base at y=0. The chamfer catches a thin line of light on edges.
export const chamferBox = (w: number, h: number, d: number, b: number) => {
  const s = new THREE.Shape();
  const x = w / 2 - b, z = d / 2 - b;
  s.moveTo(-x, -z);
  s.lineTo(x, -z);
  s.lineTo(x, z);
  s.lineTo(-x, z);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1});
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
};

export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute('uv');
  g.translate(x, y + h / 2, z);
  return g;
};

// Instanced mesh with per-instance colour and transform, shadows on.
export const instanced = (geo: THREE.BufferGeometry, items: {m: THREE.Matrix4; c: string}[], shadow = true) => {
  const mesh = new THREE.InstancedMesh(geo, flat(), Math.max(1, items.length));
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, it.m);
    mesh.setColorAt(i, col(it.c));
  });
  mesh.count = items.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
};

export const mat4 = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

// Trees: icosphere canopy (detail 0) on a 4-sided trunk. Three variants by proportion.
export const TREE_VARIANTS = [
  {r: 0.2, sy: 1.0, trunk: 0.16},
  {r: 0.16, sy: 1.35, trunk: 0.2},
  {r: 0.24, sy: 0.85, trunk: 0.13},
];
export const treeGeometry = () => {
  const canopy = new THREE.IcosahedronGeometry(1, 0); // unit; scaled per instance
  canopy.deleteAttribute('uv');
  const trunk = new THREE.CylinderGeometry(0.02, 0.028, 1, 4).toNonIndexed();
  trunk.deleteAttribute('uv');
  trunk.translate(0, 0.5, 0);
  return {canopy, trunk};
};

// Cars: two stacked chamfered boxes, no wheels. Long axis along x.
export const carGeometry = () => {
  const cabin = chamferBox(0.19, 0.075, 0.14, 0.015);
  cabin.translate(-0.02, 0.09, 0);
  return mergeGeometries([chamferBox(0.34, 0.09, 0.16, 0.015), cabin]);
};

// Suspension bridge along x, centred at the origin. Towers from thin boxes; each main cable is
// six straight segments (side span, four across the main span, side span), not a curve.
export const BRIDGE = {half: 1.75, tower: 0.72, deckY: 0.56, top: 1.45, sag: 0.7, width: 0.3};

export const makeBridge = (accent: string) => {
  const {half, tower, deckY, top, sag, width: W} = BRIDGE;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(2 * half, 0.06, W, 0, deckY - 0.06, 0));
  for (const tx of [-tower, tower]) {
    for (const tz of [-W / 2, W / 2]) parts.push(box(0.07, top, 0.07, tx, -0.25, tz));
    parts.push(box(0.07, 0.07, W + 0.07, tx, top - 0.12, 0));
    parts.push(box(0.07, 0.06, W + 0.07, tx, top * 0.62, 0));
  }
  const cableY = (x: number) => sag + (top - 0.04 - sag) * (x / tower) ** 2;
  const pts = [
    new THREE.Vector2(-half, deckY + 0.02),
    ...[-1, -0.5, 0, 0.5, 1].map((u) => new THREE.Vector2(u * tower, cableY(u * tower))),
    new THREE.Vector2(half, deckY + 0.02),
  ];
  const seg = (a: THREE.Vector3, b: THREE.Vector3, t: number) => {
    const g = new THREE.BoxGeometry(a.distanceTo(b), t, t).toNonIndexed();
    g.deleteAttribute('uv');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    return g;
  };
  for (const z of [-W / 2, W / 2]) {
    for (let i = 0; i < pts.length - 1; i++) {
      parts.push(seg(new THREE.Vector3(pts[i].x, pts[i].y, z), new THREE.Vector3(pts[i + 1].x, pts[i + 1].y, z), 0.022));
    }
    for (const x of [-0.48, -0.24, 0, 0.24, 0.48]) parts.push(box(0.012, cableY(x) - deckY, 0.012, x, deckY, z));
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), flat(col(accent)));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const piers = new THREE.Mesh(mergeGeometries([-tower, tower].map((x) => box(0.2, 0.3, W + 0.16, x, -0.25, 0))), flat(col(PALETTE.sidewalk)));
  piers.castShadow = true;
  piers.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh, piers);
  return {group: g, mesh};
};
