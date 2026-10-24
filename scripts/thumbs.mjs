// Re-render just the set thumbnails (out/sets/<id>/cover.png + probe.png), without the lint,
// typecheck and repair loop of check-set.mjs: one bundle is reused for every set, so all of them
// take a couple of minutes. Use check-set.mjs when a pack changed; use this after a change to the
// probe film or the act library that should show up in every preview.
// usage: node scripts/thumbs.mjs [id ...]   (default: every set in the registry)
import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {probeProps} from './check-set.mjs';
import {listSets, writeRegistry} from './sets-registry.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => execFileSync(NPX, args, {cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32'});
const BDIR = 'out/bundles/thumbs';

export const thumbSet = (id, bundle = BDIR) => {
  const dir = join(ROOT, 'out', 'sets', id);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'probe-props.json'), JSON.stringify(probeProps(id)));
  for (const [name, fr] of [['cover', 0], ['probe', 300]]) {
    run(['remotion', 'still', bundle, 'WhatIf', `out/sets/${id}/${name}.png`, `--frame=${fr}`, `--props=out/sets/${id}/probe-props.json`, '--scale=0.5', '--log=error']);
    console.log(`${id}: ${name}.png`);
  }
  return {cover: `out/sets/${id}/cover.png`, probe: `out/sets/${id}/probe.png`};
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : listSets().map((s) => s.id);
  writeRegistry();
  try {
    run(['remotion', 'bundle', '--out-dir', BDIR, '--log=error']);
    for (const id of ids) thumbSet(id);
  } finally {
    rmSync(join(ROOT, BDIR), {recursive: true, force: true});
  }
  console.log(`done: ${ids.length} set(s)`);
}
