// The set-pack contract. A set pack is one folder under src/sets/<id>/ that builds the stage a film
// plays on (a city on a river, a desert, an island...). The act library (effects.ts) only talks to
// a set through SetBuild, so any pack that fills it in gets every act: towers, blackout, rockets,
// water, crowd, snow, rain, and the hero figure.
//
// Conventions every pack follows (scripts/check-set.mjs enforces the mechanical ones):
// - Build everything in local coordinates inside `local`; `group` holds `local` plus anything in world
//   space (a water plane, a far horizon). The camera sits at world (0, 3.4, 12) looking toward -z with
//   a 24 deg vertical FOV; the hero point is world (0, 0, -6). Frame the stage for that camera.
// - Diorama scale: buildings 0.4-2 m tall, trees ~0.3-0.6 m, people 0.1 m. The long lens reads it as a model.
// - Flat-shaded Lambert only (kit.flat), low poly, instanced where there are many.
// - Colours only from the pack's own palette.ts (or the shared one). No hex anywhere else.
// - Deterministic: kit.rand(seed, key) only. No Math.random, Date.now, performance.now.
import type * as THREE from 'three';

export type Rect = {x0: number; x1: number; z0: number; z1: number; y?: number};
export type Building = {x: number; z: number; w: number; h: number; d: number; far: boolean};
export type Clear = {x: number; z: number; r: number};
export type Lot = {x: number; z: number; hx: number; hz: number};

export type SetOpts = {
  seed: string; // the film's seed: every random choice derives from it
  accent: string; // the film's one saturated colour (hex), for the pack's signature landmark
  server: boolean; // keep `lot` empty: a blackout act will put a server farm there
  clear: Clear[]; // world-space circles to keep free of props (the hero's spot)
};

export type SetBuild = {
  group: THREE.Group; // added to the scene
  local: THREE.Group; // the pack's frame; effects add children here in local coordinates
  toWorld: (x: number, z: number) => THREE.Vector3; // local (x, z) at y=0 -> world
  landY: number; // height of the main ground surface in local coordinates
  water: THREE.Object3D | null; // raised by water and rain acts (y = level in metres); null = no sea
  buildings: THREE.InstancedMesh | null; // what towers acts grow and snow caps cover
  records: Building[]; // one per building instance, same order, local coords, base at landY
  walk: Rect[]; // open ground people can stand on, local; walk[0] fills first (the "park")
  snow: Rect[]; // ground rectangles snow covers, local, at landY
  lot: Lot; // where a server farm can stand, local
  // rocket pads: a world-space row band; pads go 4 per row from x0 to x1, rows step back (-z) from z,
  // and any spot `ok` rejects is skipped (keep them on water or open ground, behind the hero point)
  pads: {x0: number; x1: number; z: number; ok: (world: THREE.Vector3) => boolean};
};

export type SetMeta = {
  id: string;
  name: string;
  description: string; // one sentence: what the viewer sees
  biome: string; // e.g. coastal city, desert, tropical island, mountains, arctic, moon
  tags: string[];
  author: string;
  status: 'approved' | 'draft';
  prompt?: string; // the brief it was generated from, if any
};

export type SetPack = {
  sky?: {top: string; horizon: string}; // optional sky for the set (e.g. a black moon sky); else the film's weather
  hero: {x: number; z: number; yaw: number}; // world spot for the hero figure (sits on landY), facing +z turned by yaw
  build: (opts: SetOpts) => SetBuild;
};
