// Single source of truth for colour. Scene files import from here; no hex literals elsewhere.
import * as THREE from 'three';

export const PALETTE = {
  skyTop: '#7FA8D9',
  skyHorizon: '#D8E4F0',
  cloud: '#F2F4F6',
  asphalt: '#4B4F55',
  sidewalk: '#C9CDD2',
  grass: '#6FA35C',
  canopyA: '#5E9E4E',
  canopyB: '#46803C',
  trunk: '#8C7362',
  bridge: '#C0392B',
  water: '#8FB8D4',
  buildings: ['#D9B8A8', '#C9CDD8', '#A8B8C8', '#E0D5C0', '#B87868'],
  cars: ['#F2F4F6', '#C9CDD8', '#E0D5C0', '#A8B8C8'],
  text: '#FFFFFF',
  textShadow: 'rgba(0,0,0,0.28)',
  // light colours (light.ts)
  sun: '#FFF6E8',
  hemiSky: '#BFD9F2',
  hemiGround: '#6FA35C',
} as const;

export const col = (hex: string) => new THREE.Color(hex);
