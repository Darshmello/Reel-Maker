// The film's 3D: the spec's set pack (src/sets/<id>), the hero, and each act's one change, all driven
// by the world frame from beats.eff(fr) (which also performs the end-card rewind).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ThreeCanvas, Stage} from '../kit/ThreeCanvas';
import {camAt, makeCamera, placeCamera} from '../kit/Camera';
import type {Beats} from '../film/beats';
import {ACCENTS} from '../style/lowpoly/palette';
import {DEFAULT_SET, SETS} from '../sets/registry';
import {addLights, LIGHT, skyTexture} from '../style/lowpoly/light';
import {makeDarsh} from '../style/lowpoly/darsh';
import {makeEffects, waterLevel} from '../style/lowpoly/effects';

// the hero figure's size; where it sits comes from the set pack
export const HERO_SCALE = 1.3;
// shadow focus: the hero point every set is framed around
const FOCUS = new THREE.Vector3(0, 0, -6);

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

export const S01_City: React.FC<{beats: Beats; fr: number}> = ({beats, fr}) => {
  const build = useMemo(
    () => (): Stage => {
      const {spec} = beats;
      const accent = ACCENTS[spec.accent];
      const scene = new THREE.Scene();
      const {pack} = SETS[spec.set ?? DEFAULT_SET] ?? SETS[DEFAULT_SET];
      scene.background = skyTexture(0.09, spec.weather, pack.sky);
      const H = pack.hero;
      const city = pack.build({
        seed: spec.seed,
        accent,
        server: spec.acts.some((a) => a.kind === 'blackout'),
        clear: spec.hero ? [{x: H.x, z: H.z + 0.2, r: 0.8}] : [],
      });
      scene.add(city.group);
      addLights(scene, FOCUS, 7, LIGHT, spec.weather, pack.sky?.horizon);
      const hero = spec.hero === 'darsh' ? makeDarsh() : null;
      if (hero) {
        hero.group.position.set(H.x, city.landY, H.z);
        hero.group.rotation.y = H.yaw;
        hero.group.scale.setScalar(HERO_SCALE);
        scene.add(hero.group);
      }
      const fx = makeEffects({city, beats, seed: spec.seed, accent, scene});
      const camera = makeCamera();
      const lock = beats.acts[0]?.start ?? beats.endStart;
      const camV = new THREE.Vector3();
      return {
        scene,
        camera,
        update: (f) => {
          const e = beats.eff(f);
          const p = camAt(e, beats.camKeys);
          placeCamera(camera, p);
          camV.copy(camera.position);
          if (city.water) city.water.position.y = waterLevel(e, beats);
          hero?.pose({phone: 1 - smooth((e - lock - 4) / 16), lid: smooth((e - lock - 12) / 18), type: smooth((e - lock - 28) / 12), t: e});
          for (const x of fx) x.update(e, camV);
        },
      };
    },
    [beats],
  );
  return <ThreeCanvas fr={fr} build={build} />;
};
