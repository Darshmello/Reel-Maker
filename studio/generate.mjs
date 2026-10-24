// Prompt -> full film spec. Writes the acts with the local `claude` CLI (the user's own Claude Code
// login: no API key, nothing installed) using structured output, then fills the mechanical fields
// (slug, seed, cameras, intensities) and validates with the same checks as the form. If the CLI is
// missing or fails, a small keyword-based writer drafts the spec offline instead.
import {execFileSync, spawn} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listSets} from '../scripts/sets-registry.mjs';

export const KIND_RANGE = {towers: [5, 40], rockets: [1, 20], water: [0.1, 1.2], crowd: [100, 6000], snow: [0.1, 1], rain: [0.05, 1]};
const KIND_DEFAULT = {towers: [30, 30, 40], rockets: [6, 10, 14], water: [0.42, 0.8, 1.1], crowd: [700, 2200, 5000], snow: [0.45, 1, 1], rain: [0.15, 0.55, 0.85]};
const CAMS = [{x: -0.35, z: 10.5}, {x: 0.6, z: 11}, {x: 0, z: 14}, {x: 0.3, z: 12.5}];
const VOICES = ['en-US-AndrewNeural', 'en-US-AriaNeural', 'en-US-GuyNeural', 'en-US-JennyNeural', 'en-GB-RyanNeural', 'en-GB-SoniaNeural', 'en-AU-NatashaNeural'];
const KINDS = ['towers', 'blackout', 'rockets', 'water', 'crowd', 'snow', 'rain'];

const counter = {
  type: 'object',
  properties: {label: {type: 'string'}, from: {type: 'number'}, to: {type: 'number'}, decimals: {type: 'integer'}, prefix: {type: 'string'}, suffix: {type: 'string'}},
  required: ['label', 'from', 'to'],
};
const line = {type: 'object', properties: {line: {type: 'string'}, anchor: {type: 'string'}}, required: ['line', 'anchor']};
const SCHEMA = {
  type: 'object',
  properties: {
    title: {type: 'string'},
    accent: {enum: ['red', 'orange', 'teal', 'violet', 'mustard']},
    weather: {enum: ['clear', 'overcast', 'golden']},
    hero: {type: 'boolean'},
    voice: {enum: VOICES},
    // the review notes: what the film does and why each beat is there (shown before generating, not saved)
    plan: {type: 'string'},
    intro: line,
    acts: {
      type: 'array', minItems: 1, maxItems: 5,
      items: {type: 'object', properties: {kind: {enum: KINDS}, anchor: {type: 'string'}, label: {type: 'string'}, line: {type: 'string'}, counter, amount: {type: 'number'}, why: {type: 'string'}}, required: ['kind', 'anchor', 'label', 'line', 'counter']},
    },
    end: {type: 'object', properties: {line: {type: 'string'}, anchor: {type: 'string'}, title: {type: 'string'}, rewind: {type: 'boolean'}}, required: ['line', 'anchor', 'title', 'rewind']},
  },
  required: ['title', 'accent', 'weather', 'hero', 'voice', 'scene', 'set', 'intro', 'acts', 'end'],
};
SCHEMA.properties.scene = {type: 'string'};
// camera shots per act; same table as src/kit/Camera.tsx SHOTS (keep in sync)
export const SHOTS = {standard: {}, wide: {h: 4.2, tilt: -11}, aerial: {h: 7.5, tilt: -25}, low: {h: 2.1, tilt: -4}, 'orbit-left': {yaw: 0.38}, 'orbit-right': {yaw: -0.38}};
SCHEMA.properties.acts.items.properties.shot = {enum: Object.keys(SHOTS)};
SCHEMA.properties.acts.items.required.push('shot');
SCHEMA.properties.set = {type: 'string'};

// the installed set packs the writer may choose from (approved first; drafts are fine too)
const setMenu = () =>
  listSets()
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'approved' ? -1 : 1))
    .map((m) => `- ${m.id}: ${m.description} [${m.biome}${m.status === 'draft' ? ', draft' : ''}]`)
    .join('\n');
const SET_RULES = () => `
Where the film happens (the set). Each film plays on one set pack: a low-poly diorama stage.
- scene: one or two sentences describing the place THIS idea needs, concrete and visual, for an artist who
  will build a new set for it (terrain, a landmark in the accent colour, buildings, vegetation, what fills the
  foreground). Make it specific to the idea and recognisable: "Antarctica melts" -> an Antarctic research
  station on ice shelves with penguins and a red-roofed base, not a generic city; "cats run the government"
  -> a capital with a domed parliament and cat-tree towers. Never describe the default bridge city unless the
  idea is explicitly about it. Write it even when an installed set fits.
- set: the id of the installed set that fits best right now (the studio can also build a new one from scene):
${setMenu()}
Pick the set whose place matches the idea; use city-bridge only when the idea is about a generic city.

Camera. Each act's single move ends on a shot (same long lens, so it always reads as a model):
- standard: the default three-quarter view over the set
- wide: a little higher and further back; shows more of the place
- aerial: high and steep, looking down; best for scale (crowds filling everything, floods, snow cover)
- low: near ground level looking across; things loom (towers rising, rockets, a wall of water)
- orbit-left / orbit-right: the camera swings around the set; a fresh angle for variety
Give each act the shot that sells its change, vary them across the acts, and save aerial or wide for the
biggest act. hero is false unless the idea is about Darsh: never put him in a film just because a set has room.`;

const SYSTEM = `You write plans (specs) for 36-second vertical "what if" Reels. Every film shows one low-poly pastel 3D
diorama (the set: a city, a desert town, an island...) from one slowly moving camera, with one landmark painted
in the accent colour. A calm narrator reads the script.
The film opens on the question, runs one to five acts that escalate in time and scale, and ends on a dry punchline.
Use three acts unless the idea naturally has two or four (a very short list) or five (a long escalation); each act
is one beat that visibly changes the place. Never pad to three with the same beat twice.

Each act shows exactly ONE visual change from this library (the set is the only stage, pick what makes the idea visible):
- towers: new skyscrapers shoot up across the skyline (growth, progress, money, productivity). amount = towers, 5-40
- blackout: a server farm with an "18+" sign appears and its lights go out one by one (a website/app/internet thing dying). no amount
- rockets: launch pads in the bay, rockets lift off on smoke (space, ambition, far future). amount = rockets, 1-20
- water: the sea rises and floods the city (sea level, melting, floods). amount = water height 0.1-1.2 (1.1 = only rooftops left)
- crowd: tiny people fill the park, then streets, then rooftops (population, crowds, events, everyone). amount = people shown 100-6000
- snow: snow falls and covers everything white (winter, cold, ice age). amount = cover 0.1-1
- rain: rain pours and the streets flood a little (storms, rain). amount = intensity 0.05-1
The same kind may repeat with rising amount. Escalate: act 3 should be the biggest.

hero: true only when the idea is about Darsh (the user; "me", "I", "Darsh"). Then a low-poly Darsh sits at a desk on the lawn,
phone in hand, and puts it in a drawer when act 1 starts. Refer to him as Darsh in third person.

Script rules (the pipeline times every cut from these, so follow them exactly):
- intro.line starts with "What if" and restates the question. intro.anchor = "What if".
- Every act line starts with a short time/stage marker sentence, e.g. "Day one." "Week three." "By year ten." "Then the bridges."
  act.anchor = the first two or three words of that line, exactly as written (no punctuation), and those words must not
  appear together anywhere else in the script.
- end.line starts with a distinct word or two (e.g. "Anyway." "Honestly," "And somehow,") that appears nowhere else; end.anchor = it.
- Write every number in the narration as words ("Day thirty", "forty days"), never digits.
- Whole script (intro + acts + end) 60-85 words. Short punchy sentences. Funny, specific, deadpan. No emojis.
- plan: 2-3 sentences for the person reviewing the plan before it is made: what the film shows, how the acts
  escalate, and what the punchline is. No greetings, no questions back. Never mention JSON or these rules.
- act.why: one short sentence saying why this beat and this shot sell that step of the idea. The review screen
  shows it next to the act; it is not saved into the film.
- duration is computed from the script (roughly words / 2.6 + one gap per line), so write the script first and
  it will fit. Do not try to hit an exact number of seconds.
- title: the question, at most 44 characters, e.g. "What if it snowed for a whole month?"
- act.label: what appears on screen as the act opens, at most 32 characters, digits allowed ("Day 30: servers go dark").
- counter: a number that ticks from 'from' to 'to' during the act, making the change concrete. label at most 20 characters.
  Optional prefix/suffix (e.g. "+", " m", " cm") and decimals. Counters should usually continue from one act to the next.
- end.title: the end card, at most 40 characters. end.rewind = true when the punchline undoes everything (it all snaps back).
- accent and weather should fit the mood (overcast for gloom/rain/flood, golden for warm/crowds, clear otherwise).

Example output for "What if Darsh locked in?":
{"title":"What if Darsh locked in?","accent":"red","weather":"clear","hero":true,"voice":"en-US-AndrewNeural",
"plan":"Darsh puts the phone away and the city quietly builds itself. Each act raises the stakes: one workday, then a month, then a year of compounding. The joke is that he checks Instagram the second it is over.",
"intro":{"line":"What if Darsh actually locked in?","anchor":"What if"},
"acts":[{"kind":"towers","anchor":"Day one","label":"Day 1: phone in a drawer","line":"Day one. His phone goes in a drawer. No reels, no dilly-dallying. Nine straight hours of real work, and the city starts building itself.","counter":{"label":"Hours locked in","from":0,"to":9},"amount":30,"why":"Towers show the work compounding, and the standard shot keeps Darsh and the skyline in one frame."},
{"kind":"blackout","anchor":"Day thirty","label":"Day 30: a certain website shuts down","line":"Day thirty. A certain website quietly shuts down its servers. Turns out, Darsh was their main user.","counter":{"label":"Servers online","from":4096,"to":0},"why":"The one joke that lands harder as a small visual: a server farm going dark at the edge of the city."},
{"kind":"rockets","anchor":"Year one","label":"Year 1: Type II civilization","line":"Year one. The work compounds. Launch pads fill the bay, a rocket goes up every minute, and humanity becomes a Type Two civilization.","counter":{"label":"Kardashev scale","from":0.73,"to":2,"decimals":2,"prefix":"Type "},"amount":10,"why":"The biggest act gets the low shot so the rockets loom over the bay."}],
"end":{"line":"Anyway. Darsh just opened Instagram.","anchor":"Anyway","title":"Anyway. He just opened Instagram.","rewind":true}}`;

// ---- agents: CLI writers from agents.json (+ agents.local.json for the user's choice and custom ones)
const HERE = import.meta.dirname;
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
export const agentConfig = () => {
  const base = readJson(join(HERE, 'agents.json'), {agents: []}).agents;
  const local = readJson(join(HERE, 'agents.local.json'), {});
  const custom = (local.custom ?? []).map((a) => ({...a, custom: true}));
  const agents = [...base.filter((a) => !custom.some((c) => c.id === a.id)), ...custom];
  return {agents, selected: local.selected ?? 'claude', local};
};
export const saveAgentConfig = (patch) => {
  const p = join(HERE, 'agents.local.json');
  const cur = readJson(p, {});
  writeFileSync(p, JSON.stringify({...cur, ...patch}, null, 2) + '\n');
};
// is the command's program on PATH? (where.exe also finds .cmd/.ps1 npm shims)
const found = new Map();
export const installed = (a) => {
  if (a.builtin) return true;
  const exe = a.command.trim().match(/^"([^"]+)"|^(\S+)/);
  const name = exe[1] ?? exe[2];
  if (!found.has(name)) {
    try {
      execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], {stdio: 'ignore'});
      found.set(name, true);
    } catch {
      found.set(name, false);
    }
  }
  return found.get(name);
};

const brief = (request) => `${SYSTEM}
${SET_RULES()}

The output must match this JSON Schema:
${JSON.stringify(SCHEMA)}

Do not use tools, run commands or edit files. Reply with only the JSON object: no prose, no code fences.

${request}`;

// first balanced {...} in the text that parses as JSON
export const extractJson = (text, test = (o) => o.acts) => {
  const t = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (let i = t.indexOf('{'); i !== -1; i = t.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { const o = JSON.parse(t.slice(i, j + 1)); if (o && test(o)) return o; } catch {}
        break;
      }
    }
  }
  throw new Error('no matching JSON in the agent output');
};

// Run a CLI agent on a brief; resolves with the first JSON object in its reply that passes `test`.
// `cwd` lets a reviewing agent read files (its renders); `command` overrides the agent's command.
// `onLog(kind, text)` streams the exact command and the CLI's own output, live, for the studio log.
const ansi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
export const runAgent = (agent, text, {ms = 240000, test, cwd, command, onLog = () => {}} = {}) =>
  new Promise((ok, bad) => {
    const dir = mkdtempSync(join(tmpdir(), 'reel-writer-'));
    const file = join(dir, 'brief.md');
    writeFileSync(file, text);
    const base = command ?? agent.command;
    const usesFile = base.includes('{promptFile}');
    const cmd = base.replaceAll('{promptFile}', `"${file}"`);
    const started = Date.now();
    onLog('command', `${agent.name}: ${ansi(cmd)}`);
    onLog('spawn', `cwd ${cwd ?? dir} · timeout ${Math.round(ms / 1000)}s · brief ${text.length} chars`);
    const p = spawn(cmd, {cwd: cwd ?? dir, shell: true, windowsHide: true});
    let out = '', err = '';
    const done = () => { clearTimeout(t); rmSync(dir, {recursive: true, force: true}); };
    const t = setTimeout(() => {
      p.kill();
      const message = `${agent.name} timed out after ${ms / 1000}s. Last output: ${ansi(out + err).trim().slice(-200)}`;
      onLog('error', message);
      bad(new Error(message));
    }, ms);
    const pump = (kind) => (d) => {
      for (const line of ansi(d).split(/\r?\n/)) if (line.trim()) onLog(kind, line.trim().slice(0, 400));
    };
    p.stdout.on('data', (d) => { out += d; pump('stdout')(d); });
    p.stderr.on('data', (d) => { err += d; pump('stderr')(d); });
    p.on('error', (e) => (done(), onLog('error', e.message), bad(e)));
    p.on('close', (code) => {
      done();
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      onLog('exit', `exit ${code} after ${secs}s · stdout ${out.length} chars · stderr ${err.length} chars`);
      try {
        let body = out;
        if (agent.mode === 'claude-json') {
          const j = JSON.parse(out);
          if (j.is_error) throw new Error(j.result || 'error');
          body = j.result;
        }
        const parsed = extractJson(body, test);
        onLog('parsed', `got JSON: ${parsed.title ? `"${parsed.title}" · ` : ''}${Array.isArray(parsed.acts) ? `${parsed.acts.length} act(s)` : Array.isArray(parsed.files) ? `${parsed.files.length} file(s)` : 'ok'}`);
        ok(parsed);
      } catch (e) {
        onLog('error', e.message);
        bad(new Error(`${agent.name} (exit ${code}): ${e.message}. ${ansi(err || out).trim().slice(-240)}`));
      }
    });
    if (usesFile) p.stdin.end();
    else p.stdin.end(text);
  });

const slugify = (t) => t.toLowerCase().replace(/^what if\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || 'new-film';
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));
const wordsIn = (s) => [s.intro, ...(s.acts ?? []), s.end].reduce((n, l) => n + (String(l?.line ?? '').match(/\S+/g)?.length ?? 0), 0);
// the script decides the length: edge-tts reads ~2.6 words/s; one gap per line + head and tail (see make_vo.py)
export const durationFor = (words, lines) => clamp(Math.ceil(2.8 + words / 2.6 + Math.max(0, lines - 1) * 0.9), [20, 75]);
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// mechanical fields the writer never decides
const finish = (g, slugs) => {
  let slug = slugify(g.title), n = 2;
  const base = slug;
  while (slugs.includes(slug)) slug = `${base}-${n++}`;
  const acts = g.acts.slice(0, 5).map((a, i) => {
    const c = {label: a.counter.label, from: a.counter.from, to: a.counter.to};
    if (a.counter.decimals) c.decimals = a.counter.decimals;
    if (a.counter.prefix) c.prefix = a.counter.prefix;
    if (a.counter.suffix) c.suffix = a.counter.suffix;
    const shot = SHOTS[a.shot] ? a.shot : 'standard';
    const act = {kind: a.kind, anchor: a.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), label: a.label, line: a.line, counter: c, shot, cam: {...CAMS[i % CAMS.length], ...SHOTS[shot]}};
    if (KIND_RANGE[a.kind]) act.amount = clamp(a.amount ?? KIND_DEFAULT[a.kind][Math.min(i, 2)], KIND_RANGE[a.kind]);
    if (a.why) act.why = clean(a.why, 240);
    return act;
  });
  const spec = {
    slug, seed: slug, title: g.title, accent: g.accent, weather: g.weather, hero: g.hero ? 'darsh' : null,
    voice: VOICES.includes(g.voice) ? g.voice : VOICES[0],
    set: listSets().some((m) => m.id === g.set) ? g.set : 'city-bridge',
    ...(g.scene ? {scene: String(g.scene).slice(0, 400)} : {}),
    intro: {line: g.intro.line, anchor: g.intro.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), cam0: {x: 0, z: 12}, cam: {x: -0.1, z: 11.5}},
    acts,
    end: {line: g.end.line, anchor: g.end.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), title: g.end.title, rewind: !!g.end.rewind},
  };
  spec.duration = durationFor(wordsIn(spec), acts.length + 2);
  if (g.plan) spec.plan = clean(g.plan, 600);
  return spec;
};

// ---- offline writer: keyword -> act kinds, templated lines. A draft to edit, not a finished script.
const RULES = [
  [/snow|winter|ice age|blizzard|cold/, ['snow', 'snow', 'crowd'], 'mustard', 'clear'],
  [/rain|storm|monsoon|downpour/, ['rain', 'rain', 'rain'], 'teal', 'overcast'],
  [/sea|ocean|flood|melt|tide|water/, ['water', 'water', 'water'], 'orange', 'overcast'],
  [/rocket|space|mars|moon|planet|launch|civili[sz]ation|alien/, ['towers', 'rockets', 'rockets'], 'violet', 'clear'],
  [/internet|website|server|wifi|app|online|phone|social|instagram|tiktok/, ['blackout', 'towers', 'rockets'], 'red', 'clear'],
  [/everyone|people|population|crowd|party|concert|human/, ['crowd', 'crowd', 'crowd'], 'violet', 'golden'],
];
const STAGES = [['Day one', 'Day 1'], ['Week three', 'Week 3'], ['Year one', 'Year 1']];
const BEAT = {
  towers: ['the skyline starts climbing, one tower at a time', 'New towers', 0, 30],
  blackout: ['the servers on the edge of town go dark, one rack at a time', 'Servers online', 4096, 0],
  rockets: ['launch pads fill the bay and the first rockets lift off', 'Rockets launched', 0, 120],
  water: ['the water creeps over the harbour walls and keeps coming', 'Sea level', 0, 120],
  crowd: ['people pour into the park, then the streets, then the rooftops', 'People', 0, 100000],
  snow: ['the first flakes fall and the whole city goes quiet and white', 'Snow depth', 0, 60],
  rain: ['the rain starts and simply does not stop', 'Days of rain', 0, 20],
};
const draft = (prompt) => {
  const q = prompt.trim().replace(/\?*$/, '?');
  const question = /^what if/i.test(q) ? q[0].toUpperCase() + q.slice(1) : `What if ${q[0].toLowerCase()}${q.slice(1)}`;
  const low = question.toLowerCase();
  const [, kinds, accent, weather] = RULES.find(([re]) => re.test(low)) ?? [null, ['towers', 'crowd', 'rockets'], 'teal', 'clear'];
  const hero = /\bdarsh\b|\bi\b|\bme\b|\bmy\b/.test(low);
  return {
    title: question.length <= 44 ? question : question.slice(0, 43).replace(/\s+\S*$/, '').replace(/(\s+(the|a|an|on|of|to|in|for|and|at|with|their|his|her|my))+$/i, '') + '?', accent, weather, hero, voice: VOICES[0],
    intro: {line: question, anchor: 'What if'},
    acts: kinds.map((k, i) => {
      const [txt, label, from, to] = BEAT[k];
      const scale = [1, 4, 20][i];
      return {kind: k, anchor: STAGES[i][0], label: `${STAGES[i][1]}`, line: `${STAGES[i][0]}. Somehow, ${txt}.`, counter: {label, from: i ? from + (to - from) * [0, 1, 4][i] : from, to: from + (to - from) * scale}};
    }),
    end: {line: 'Honestly, nobody saw that coming.', anchor: 'Honestly', title: 'Nobody saw that coming.', rewind: false},
  };
};

export async function generate(prompt, {validate, slugs, agentId, onLog = () => {}, ms = 480000}) {
  const {agents, selected} = agentConfig();
  const agent = agents.find((a) => a.id === (agentId ?? selected)) ?? agents[0];
  const ask = `Write the plan for: ${prompt.trim()}`;
  let note = null;
  if (agent && !agent.builtin) {
    try {
      let spec = finish(await runAgent(agent, brief(ask), {ms, onLog}), slugs);
      let v = validate(spec);
      if (!v.ok) {
        onLog('check', `first draft failed ${v.errors.length} check(s), asking for a fix: ${v.errors.join('; ').slice(0, 300)}`);
        spec = finish(await runAgent(agent, brief(`${ask}\n\nA previous attempt failed these checks; fix them:\n- ${v.errors.join('\n- ')}\n\nPrevious attempt:\n${JSON.stringify(spec)}`), {ms, onLog}), slugs);
        v = validate(spec);
      }
      return {spec, check: v, source: agent.name};
    } catch (e) {
      note = String(e.message ?? e).slice(0, 400);
      onLog('fallback', `${agent.name} did not return a plan (${note.slice(0, 160)}); drafting offline instead`);
    }
  } else {
    onLog('fallback', 'no CLI writer selected; drafting offline');
  }
  const spec = finish(draft(prompt), slugs);
  return {spec, check: validate(spec), source: 'Offline draft', note};
}
