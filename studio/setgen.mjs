// Prompt -> new set pack. A CLI agent writes src/sets/<id>/{palette.ts,index.ts,meta.json} against
// the SetBuild contract, using the kit and the Desert Pyramids pack as a worked example. Each draft
// goes through scripts/check-set.mjs (lint, typecheck, render inside a probe film); failures are fed
// back for up to two repairs. Claude Code then looks at its own cover and probe renders once and may
// revise. New packs are saved as drafts until approved in the studio.
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {agentConfig, runAgent} from './generate.mjs';
import {checkSet} from '../scripts/check-set.mjs';
import {listSets, writeRegistry} from '../scripts/sets-registry.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SETS = join(ROOT, 'src', 'sets');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const RULES = `You write set packs for a renderer of 36-second vertical "what if" Reels in a low-poly pastel 3D
diorama style (flat-shaded, soft, quiet, like a tilt-shift model). A set pack builds the stage one film plays on.
The act library animates any set through the SetBuild contract: towers grow the pack's buildings, a server farm
stands on its lot, rockets launch from its pad band, crowds fill its walk rects, snow covers its snow rects,
water raises its sea plane. Your pack must give every one of those a sensible place.

Camera (fixed, do not fight it): world position (0, 3.4, 12), looking toward -z, tilted 10 deg down, vertical
FOV 24 deg, 9:16 frame. Long lens: at local z 0 (world z -6, 18 m away) the frame is only ~4.2 m wide; the
bottom frame edge meets ground near world z 4.7 (local z 10.7); the frame centre hits ground near world z -4.7.
Fog runs 80-220 m. With frame(0) (no yaw), local z = world z + 6 and local x = world x.

Composition rules (from the approved reference look):
- The lower half of the frame must be FILLED with small readable things seen from above: low buildings, trees,
  roads, fields, boats. Empty ground near the camera is the most common failure.
- One signature landmark in the accent colour (opts.accent), mid-ground or far, readable but not dominating
  (the city's bridge, the pyramids' capstones). Everything else is pastel and quiet.
- Depth: near small things, a mid-ground, then a hazy far layer (skyline, hills, mountains) 60-180 m away.
- Scale: buildings 0.2-2 m tall, trees 0.3-0.7 m, people 0.1 m, roads 0.3-0.5 m wide. A model, not a game.
- Keep the hero spot (pack.hero, world coords) on open ground inside walk[0], 0.5-1.5 m left of centre,
  world z between -2 and 0. Keep opts.clear circles free of props (use isClear).
- When opts.server is true keep the lot empty. The lot must be in frame: local x within +-1.8, local z -1..2.
- Always add a sea plane (kit.sea) as \`water\` just under the ground (landY 0.2-0.5) so water acts can flood.
- buildings/records come from kit.blocks (or your own instanced chamferBox with matching records).
- walk[0] is the open plaza/park/beach near the hero; 2-6 more walk rects for streets, quays, fields.
- pads: a world band behind the mid-ground (z around -14 to -24) where rockets can stand; ok() rejects spots on
  buildings or landmarks.
- Budget: under ~6000 instances and ~150k triangles total. Instance anything repeated.

Code rules (enforced by a checker; a violation fails the pack):
- Files: palette.ts (export const P = {...} as const: every colour of the pack as a hex string), index.ts
  (export const pack: SetPack), meta.json.
- Hex colours ONLY in palette.ts. index.ts uses P.* or the accent.
- Imports ONLY from '../kit' and './palette' (and type imports from '../kit' or '../types').
- Deterministic: randomness only via rand(seed, key) / pick(...) from ../kit. No Math.random, Date, timers,
  DOM, fetch, eval, dynamic import.
- TypeScript strict; the code must typecheck against the kit and types below.
- meta.json: {"id","name","description" (one sentence, what the viewer sees),"biome","tags":[...],
  "author":"<agent name>","status":"draft","prompt":"<the request>"}`;

// worked examples: Desert Pyramids (hand-written reference) plus the marketplace pack whose tags best
// match the request, so new packs learn from the closest existing ones
export const pickExamples = (request) => {
  const words = new Set(request.toLowerCase().match(/[a-z]+/g) ?? []);
  const metas = listSets().filter((m) => m.id !== 'city-bridge' && m.id !== 'desert-pyramids');
  const score = (m) => [...m.tags, ...m.biome.split(/\W+/), ...m.name.toLowerCase().split(/\W+/)].filter((t) => words.has(t.toLowerCase())).length + (m.status === 'approved' ? 0.5 : 0);
  const best = metas.map((m) => ({m, s: score(m)})).sort((a, b) => b.s - a.s)[0];
  return ['desert-pyramids', ...(best && best.s > 0 ? [best.m.id] : [])];
};
const example = (id) => `---- WORKED EXAMPLE: src/sets/${id}/palette.ts
${read(`src/sets/${id}/palette.ts`)}
---- WORKED EXAMPLE: src/sets/${id}/index.ts
${read(`src/sets/${id}/index.ts`)}
---- WORKED EXAMPLE: src/sets/${id}/meta.json
${read(`src/sets/${id}/meta.json`)}`;

const brief = (request, id, extra = '') => `${RULES}

---- src/sets/types.ts
${read('src/sets/types.ts')}
---- src/sets/kit.ts
${read('src/sets/kit.ts')}
---- src/style/lowpoly/props.ts (re-exported by the kit)
${read('src/style/lowpoly/props.ts')}
${pickExamples(request).map(example).join('\n')}
----

Write a new set pack with id "${id}" for this request: ${request}
${extra}
Reply with ONLY one JSON object, no prose, no code fences:
{"palette": "<full text of palette.ts>", "index": "<full text of index.ts>", "meta": {<meta.json object>}}`;

const isFiles = (o) => typeof o.palette === 'string' && typeof o.index === 'string' && o.meta && typeof o.meta === 'object';

const writePack = (id, files, request, author) => {
  const dir = join(SETS, id);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'palette.ts'), files.palette);
  writeFileSync(join(dir, 'index.ts'), files.index);
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({...files.meta, id, status: 'draft', author: files.meta.author || author, prompt: request}, null, 2) + '\n');
};

export const slugifySet = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 4).join('-') || 'new-set';

// log(stage, detail) reports progress; returns {id, ok, errors, attempts, reviewed}
export async function generateSet(request, {agentId, id, log = () => {}, review = true, onLog = () => {}} = {}) {
  const {agents, selected} = agentConfig();
  const agent = agents.find((a) => a.id === (agentId ?? selected) && !a.builtin) ?? agents.find((a) => a.id === 'claude');
  id = id ?? slugifySet(request);
  if (existsSync(join(SETS, id, 'meta.json'))) {
    let n = 2;
    while (existsSync(join(SETS, `${id}-${n}`))) n++;
    id = `${id}-${n}`;
  }
  let extra = '', last = null, attempts = 0;
  for (; attempts < 3; attempts++) {
    log('writing', `${agent.name}: attempt ${attempts + 1}`);
    let files;
    try {
      files = await runAgent(agent, brief(request, id, extra), {ms: 420000, test: isFiles, onLog});
    } catch (e) {
      last = {ok: false, errors: [String(e.message).slice(0, 400)]};
      extra = '';
      continue;
    }
    writePack(id, files, request, agent.name);
    log('checking', 'lint, typecheck, probe render');
    last = checkSet({id});
    if (last.ok) break;
    log('repairing', last.errors.slice(0, 3).join(' | '));
    extra = `\nYour previous attempt failed these checks; fix them and return all three files again:\n- ${last.errors.join('\n- ')}\n\nPrevious index.ts:\n${files.index}\n\nPrevious palette.ts:\n${files.palette}\n`;
  }
  let reviewed = false;
  if (last?.ok && review && (agent.mode === 'claude-json' || agent.read)) {
    // one visual pass: the agent reads its own renders and either approves or returns revised files
    log('reviewing', 'the agent is looking at its renders');
    const dir = join(ROOT, 'out', 'sets', id);
    const cur = {palette: readFileSync(join(SETS, id, 'palette.ts'), 'utf8'), index: readFileSync(join(SETS, id, 'index.ts'), 'utf8')};
    const ask = `${brief(request, id)}\n\nYou already wrote this pack; it passes the checks. Use the Read tool to look at cover.png (the set's opening frame) and probe.png (after a server farm, growing towers, a crowd and rockets) in the current folder. Judge them against the composition rules: is the lower half filled with small readable things, is the landmark readable in the accent colour, is there depth, does it look like a calm pastel model? Start your reply with what you saw. If it is good, reply {"ok": true, "seen": "<one sentence: what the renders show>"}. Otherwise reply with revised files in the same JSON shape plus "seen".\n\nCurrent index.ts:\n${cur.index}\n\nCurrent palette.ts:\n${cur.palette}`;
    try {
      const cmd = agent.mode === 'claude-json' ? agent.command.replace('--tools ""', '--tools Read --allowedTools Read') : agent.command;
      const r = await runAgent(agent, ask, {ms: 420000, cwd: dir, command: cmd, test: (o) => o.ok === true || isFiles(o), onLog});
      reviewed = true;
      log('reviewing', `${isFiles(r) ? 'revising' : 'approved'}: ${String(r.seen ?? '').slice(0, 200)}`);
      if (isFiles(r)) {
        const backup = {...cur, meta: JSON.parse(readFileSync(join(SETS, id, 'meta.json'), 'utf8'))};
        writePack(id, r, request, agent.name);
        log('checking', 'revised version');
        const again = checkSet({id});
        if (again.ok) last = again;
        else {
          writePack(id, backup, request, agent.name); // keep the version that passed
          last = checkSet({id});
        }
      }
    } catch (e) {
      log('reviewing', `skipped: ${String(e.message).slice(0, 160)}`);
    }
  }
  if (!last?.ok) {
    // a pack that never passed is removed so it can't break the registry
    rmSync(join(SETS, id), {recursive: true, force: true});
    writeRegistry();
  }
  return {id, ok: !!last?.ok, errors: last?.errors ?? [], attempts: attempts + 1, reviewed, agent: agent.name};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [request, id, agentId] = process.argv.slice(2);
  const r = await generateSet(request, {
    id,
    agentId: agentId || undefined,
    log: (s, d) => console.error(`[${s}] ${d}`),
    onLog: (k, t) => console.error(`[agent] ${k}: ${String(t).slice(0, 220)}`),
  });
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}
