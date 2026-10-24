// Check a set pack and render its thumbnails. Lints the source (palette-only colour, determinism,
// sandboxed imports, meta.json), typechecks, then renders the pack inside a real film: a cover
// frame and a probe frame where a blackout, towers, a crowd and rockets have all run on it.
// usage: node scripts/check-set.mjs <id> [--no-render]   -> JSON on stdout; exit 1 on failure
// Outputs: out/sets/<id>/cover.png, out/sets/<id>/probe.png (half size)
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {writeRegistry} from './sets-registry.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const PY = join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

export const lintSet = (id) => {
  const dir = join(ROOT, 'src', 'sets', id);
  const errors = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errors.push('id: lowercase words joined by dashes');
  for (const f of ['index.ts', 'meta.json']) if (!existsSync(join(dir, f))) errors.push(`missing ${f}`);
  if (errors.length) return errors;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (f !== 'palette.ts' && /#[0-9a-fA-F]{3,8}\b|0x[0-9a-fA-F]{6}\b/.test(code)) errors.push(`${f}: colour literal outside palette.ts`);
    if (/Math\.random|Date\.now|performance\.now|new Date\b|setTimeout|setInterval/.test(code)) errors.push(`${f}: non-deterministic call (use rand(seed, key) from ../kit)`);
    // city-bridge is the built-in adapter over style/lowpoly/city.ts; every other pack is sandboxed
    for (const m of id === 'city-bridge' ? [] : code.matchAll(/from\s+'([^']+)'/g)) {
      if (!['../kit', '../types', './palette'].includes(m[1]) && !m[1].startsWith('./')) errors.push(`${f}: import "${m[1]}" (packs import only ../kit, ../types and their own files)`);
    }
    if (/\b(fetch|XMLHttpRequest|import\(|require\(|eval\(|Function\(|document\.|window\.|localStorage)/.test(code)) errors.push(`${f}: network, DOM or dynamic code is not allowed in a pack`);
  }
  try {
    const m = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
    for (const k of ['name', 'description', 'biome', 'author']) if (typeof m[k] !== 'string' || !m[k].trim()) errors.push(`meta.json: ${k} is required`);
    if (!Array.isArray(m.tags)) errors.push('meta.json: tags must be a list');
    if (!['approved', 'draft'].includes(m.status)) errors.push('meta.json: status is approved or draft');
  } catch (e) {
    errors.push(`meta.json: ${e.message}`);
  }
  return errors;
};

// a 12 s probe film: synthetic word timings so every cue resolves without a voiceover.
// hero is null on purpose: a set preview shows the place, not the film's hero.
export const probeProps = (id, accent = 'teal') => {
  const lines = [['What if', 'we tested this set'], ['Day one', 'the servers'], ['Day two', 'the towers'], ['Day three', 'the people'], ['Day four', 'the rockets'], ['Anyway', 'that is the set']];
  const starts = [0.2, 1.0, 3.2, 5.4, 7.6, 10.4];
  const words = [];
  lines.forEach(([a, b], i) => `${a} ${b}`.split(' ').forEach((w, j) => words.push({w, s: starts[i] + j * 0.25, e: starts[i] + j * 0.25 + 0.2})));
  const act = (kind, anchor, cam, amount) => ({kind, anchor, label: kind, line: '', counter: {label: kind, from: 0, to: 1}, cam, ...(amount ? {amount} : {})});
  const spec = {
    slug: `probe-${id}`, seed: `probe-${id}`, title: 'Probe', accent, weather: 'clear', hero: null, voice: 'x', duration: 12, set: id,
    intro: {line: '', anchor: 'What if', cam0: {x: 0, z: 12}, cam: {x: -0.1, z: 11.6}},
    acts: [act('blackout', 'Day one', {x: 0.4, z: 11}), act('towers', 'Day two', {x: 0, z: 12}, 30), act('crowd', 'Day three', {x: -0.2, z: 12.5}, 2500), act('rockets', 'Day four', {x: 0, z: 14}, 6)],
    end: {line: '', anchor: 'Anyway', title: 'Probe'},
  };
  return {spec, words, audio: null, text: false};
};

const imageStats = (png) =>
  JSON.parse(execFileSync(PY, ['-I', '-c', 'import sys,json;from PIL import Image,ImageStat;im=Image.open(sys.argv[1]).convert("RGB");s=ImageStat.Stat(im);print(json.dumps({"std":sum(s.stddev)/3,"mean":sum(s.mean)/3}))', png], {encoding: 'utf8'}));

export const checkSet = ({id, render = true, bundle = true}) => {
  const errors = lintSet(id);
  const result = {id, ok: false, errors, cover: null, probe: null};
  if (errors.length) return result;
  writeRegistry();
  try {
    execFileSync(NPX, ['tsc', '-p', '.'], {cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32'});
  } catch (e) {
    // only this pack's errors count: another pack may be mid-generation in parallel
    const lines = String(e.stdout || e.message).split('\n').filter((l) => /error TS/.test(l));
    const mine = lines.filter((l) => l.includes(`src/sets/${id}/`) || l.includes(`src\\sets\\${id}\\`));
    const elsewhere = lines.filter((l) => !/src[\\/]sets[\\/]/.test(l));
    if (mine.length || elsewhere.length || !lines.length) {
      errors.push(...(mine.length ? mine : elsewhere.length ? elsewhere : [String(e.stdout || e.message).split('\n')[0]]).slice(0, 8).map((l) => `typecheck: ${l.trim()}`));
      return result;
    }
  }
  if (!render) return {...result, ok: true};
  const dir = join(ROOT, 'out', 'sets', id);
  mkdirSync(dir, {recursive: true});
  const props = join(dir, 'probe-props.json');
  writeFileSync(props, JSON.stringify(probeProps(id)));
  // each check bundles into its own folder, so several packs can be checked at once
  const bdir = `out/bundles/${id}`;
  try {
    if (bundle) execFileSync(NPX, ['remotion', 'bundle', '--out-dir', bdir, '--log=error'], {cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32'});
    for (const [name, fr] of [['cover', 0], ['probe', 300]]) {
      execFileSync(NPX, ['remotion', 'still', bdir, 'WhatIf', `out/sets/${id}/${name}.png`, `--frame=${fr}`, `--props=out/sets/${id}/probe-props.json`, '--scale=0.5', '--log=error'], {cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32'});
    }
  } catch (e) {
    errors.push(`render: ${String(e.stderr || e.stdout || e.message).split('\n').filter((l) => l.trim()).slice(0, 6).join(' | ')}`);
    return result;
  } finally {
    rmSync(join(ROOT, bdir), {recursive: true, force: true});
  }
  for (const name of ['cover', 'probe']) {
    const s = imageStats(join(dir, `${name}.png`));
    if (s.std < 10) errors.push(`${name}: the frame is nearly flat (std ${s.std.toFixed(1)}): the set is not in front of the camera`);
  }
  return {...result, ok: errors.length === 0, cover: `out/sets/${id}/cover.png`, probe: `out/sets/${id}/probe.png`};
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const id = process.argv[2];
  const r = checkSet({id, render: !process.argv.includes('--no-render')});
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.ok ? 0 : 1);
}
