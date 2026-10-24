// The city film's 3D: the approved set, the hero, and each act's one change, all driven by the world
// frame from beats.eff(fr) (which also performs the end-card rewind).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ThreeCanvas, Stage} from '../kit/ThreeCanvas';
import {camAt, makeCamera, placeCamera} from '../kit/Camera';
import type {Beats} from '../film/beats';
import {ACCENTS} from '../style/lowpoly/palette';
import {SET, buildCity} from '../style/lowpoly/city';
import {addLights, LIGHT, skyTexture} from '../style/lowpoly/light';
import {makeDarsh} from '../style/lowpoly/darsh';
import {makeEffects, waterLevel} from '../style/lowpoly/effects';

// where the hero sits on the park lawn (world), turned a little toward the camera
export const HERO = {x: -0.9, z: -1.0, yaw: 0.25, scale: 1.3};

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
      scene.background = skyTexture(0.09, spec.weather);
      const city = buildCity({
        seed: spec.seed,
        accent,
        server: spec.acts.some((a) => a.kind === 'blackout'),
        clear: spec.hero ? [{x: HERO.x, z: HERO.z + 0.2, r: 0.8}] : [],
      });
      scene.add(city.group);
      addLights(scene, SET.hero, 7, LIGHT, spec.weather);
      const hero = spec.hero === 'darsh' ? makeDarsh() : null;
      if (hero) {
        hero.group.position.set(HERO.x, SET.landY, HERO.z);
        hero.group.rotation.y = HERO.yaw;
        hero.group.scale.setScalar(HERO.scale);
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
          city.water.position.y = waterLevel(e, beats);
          hero?.pose({phone: 1 - smooth((e - lock - 4) / 16), lid: smooth((e - lock - 12) / 18), type: smooth((e - lock - 28) / 12), t: e});
          for (const x of fx) x.update(e, camV);
        },
      };
    },
    [beats],
  );
  return <ThreeCanvas fr={fr} build={build} />;
};
