// M0 chain test: a flat-shaded cube spinning at 1080x1920.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {ThreeCanvas, Stage} from '../kit/ThreeCanvas';
import {PALETTE, col} from '../style/lowpoly/palette';

const build = (): Stage => {
  const scene = new THREE.Scene();
  scene.background = col(PALETTE.skyHorizon);
  const camera = new THREE.PerspectiveCamera(24, 1080 / 1920, 0.1, 100);
  camera.position.set(0, 0, 14);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({color: col(PALETTE.bridge), flatShading: true}));
  scene.add(cube, new THREE.HemisphereLight(col(PALETTE.hemiSky), col(PALETTE.hemiGround), 0.8));
  const sun = new THREE.DirectionalLight(col(PALETTE.sun), 2.2);
  sun.position.set(30, 50, 20);
  scene.add(sun);
  return {
    scene,
    camera,
    update: (fr) => {
      cube.rotation.set(fr * 0.031, fr * 0.047, 0);
    },
  };
};

export const S00_Cube: React.FC = () => <ThreeCanvas fr={useCurrentFrame()} build={build} />;
