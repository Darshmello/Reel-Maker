// Generate the starter marketplace: one set pack per scene type common in low-poly "what if" Reels.
// Each pack is written by your CLI agent (studio/setgen.mjs), checked and rendered, and saved as a draft.
// usage: node scripts/seed-sets.mjs [--agent=id] [id ...]   (default: all, with the agent picked in the studio)
//        -> out/sets/seed.log
import {appendFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {generateSet} from '../studio/setgen.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const agentId = args.find((a) => a.startsWith('--agent='))?.slice(8) || process.env.AGENT || undefined;
export const SEEDS = {
  'tropical-island': 'A tropical island resort: white sand beach and turquoise shallows in front, beach huts and a small low hotel strip, palm groves, a wooden pier in the accent colour, a green volcano peak in the haze behind.',
  'alpine-village': 'An alpine village in a green valley: wooden chalets with steep roofs, pine forests, a church whose steeple is in the accent colour, a small lake by the plaza, jagged snow-capped mountains behind.',
  'harbor-town': 'A fishing harbour town: colourful stacked houses climbing a hill, quays with small fishing boats, a striped lighthouse in the accent colour on the breakwater, open sea behind.',
  'farmland': 'Rolling farmland countryside: a patchwork of crop fields and hedgerows, a small village crossroads, a big barn in the accent colour, grain silos, a row of wind turbines on low hills.',
  'canal-city': 'A Venice-like canal city: terracotta and cream buildings along canals, arched footbridges, small boats, a domed basilica with a dome in the accent colour, a lagoon behind.',
  'suburbs': 'An American suburb: curving streets of small houses with lawns and fences, a school with a playing field, a water tower in the accent colour, a strip mall, a downtown skyline in the haze.',
  'megacity': 'A dense future megacity: very tall towers stacked into the distance, an elevated monorail track in the accent colour weaving through, a plaza with a fountain and trees near the camera.',
  'moon-base': 'A moon base on grey regolith under a near-black sky (use pack.sky): craters, white habitat domes and connecting modules, solar panel arrays, a landing pad, an antenna tower in the accent colour.',
};

const log = (s) => appendFileSync(join(ROOT, 'out', 'sets', 'seed.log'), `${new Date().toISOString().slice(11, 19)} ${s}\n`);
const ids = args.filter((a) => !a.startsWith('--'));
for (const id of ids.length ? ids : Object.keys(SEEDS)) {
  if (existsSync(join(ROOT, 'src', 'sets', id, 'meta.json'))) {
    log(`${id}: exists, skipped`);
    continue;
  }
  log(`${id}: start`);
  const r = await generateSet(SEEDS[id], {id, agentId, log: (s, d) => log(`${id}: [${s}] ${d}`)});
  log(`${id}: ${r.ok ? 'OK' : 'FAILED'} after ${r.attempts} attempt(s)${r.reviewed ? ', reviewed' : ''} ${r.errors.join(' | ')}`);
}
log('done');
