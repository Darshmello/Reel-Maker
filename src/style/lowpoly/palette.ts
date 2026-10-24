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
  people: ['#F2F4F6', '#D9B8A8', '#A8B8C8', '#E0D5C0', '#C9CDD8', '#4B4F55'],
  text: '#FFFFFF',
  textShadow: 'rgba(0,0,0,0.28)',
  // light colours (light.ts)
  sun: '#FFF6E8',
  hemiSky: '#BFD9F2',
  hemiGround: '#6FA35C',
  // effects
  snow: '#F7F9FB',
  rain: '#DDE6EE',
  smoke: '#F2F4F6',
  flame: '#FFD58A',
  rocket: '#F2F4F6',
  pad: '#C9CDD2',
  server: '#5E6670',
  serverLight: '#CFF4FF',
  serverOff: '#3E444B',
  grain: '#808080',
  // the hero figure (Darsh)
  skin: '#9C6646',
  hair: '#1C1816',
  shirt: '#1E1F22',
  shirtPrint: '#F2F4F6',
  frames: '#6A4630',
  jeans: '#46505E',
  shoes: '#2A2B2E',
  desk: '#D9B8A8',
  laptop: '#C9CDD2',
  screen: '#E8F2FF',
  phone: '#2A2B2E',
} as const;

// Per-video accent (the one saturated colour). Spec files name one of these keys.
export const ACCENTS = {
  red: '#C0392B',
  orange: '#D9662B',
  teal: '#1E9A8A',
  violet: '#7A4FB5',
  mustard: '#D4A017',
} as const;
export type AccentName = keyof typeof ACCENTS;

// Per-video weather. 'clear' is the approved style frame.
export const WEATHER = {
  clear: {skyTop: PALETTE.skyTop, skyHorizon: PALETTE.skyHorizon, sun: PALETTE.sun, sunScale: 1, hemiSky: PALETTE.hemiSky},
  overcast: {skyTop: '#9AAAB9', skyHorizon: '#D3D9DF', sun: '#F1F2F2', sunScale: 0.55, hemiSky: '#C9D3DC'},
  golden: {skyTop: '#8FA6CF', skyHorizon: '#F1DCC4', sun: '#FFE2B8', sunScale: 1, hemiSky: '#D9D2E4'},
} as const;
export type WeatherName = keyof typeof WEATHER;

export const col = (hex: string) => new THREE.Color(hex);
