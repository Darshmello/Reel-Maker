// Sun + hemisphere + fog + sky. Values are the style spec; change them here only.
import * as THREE from 'three';
import {PALETTE, col} from './palette';

export const SUN_OFFSET = new THREE.Vector3(30, 50, 20);

// Shadow frustum is kept tight around the hero block (centre, half-size in metres).
export const LIGHT = {sun: 2.2, hemi: 2.0};

export const addLights = (scene: THREE.Scene, hero: THREE.Vector3, half = 7, light = LIGHT) => {
  const sun = new THREE.DirectionalLight(col(PALETTE.sun), light.sun);
  sun.position.copy(hero).add(SUN_OFFSET);
  sun.target.position.copy(hero);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -half;
  c.right = half;
  c.top = half;
  c.bottom = -half;
  c.near = 20;
  c.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.55; // soft model-like shadows: low contrast
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col(PALETTE.hemiSky), col(PALETTE.hemiGround), light.hemi);
  scene.add(hemi);
  scene.fog = new THREE.Fog(col(PALETTE.skyHorizon), 80, 220);
  return {sun, hemi};
};

// Screen-space sky: skyTop at the frame top, skyHorizon from just above the horizon down.
export const skyTexture = (horizonY = 0.1) => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(Math.min(1, horizonY), PALETTE.skyHorizon);
  grad.addColorStop(1, PALETTE.skyHorizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
