// Prompt -> full film spec. Writes the acts with the local `claude` CLI (the user's own Claude Code
// login: no API key, nothing installed) using structured output, then fills the mechanical fields
// (slug, seed, cameras, intensities) and validates with the same checks as the form. If the CLI is
// missing or fails, a small keyword-based writer drafts the spec offline instead.
import {execFileSync, spawn} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

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
    intro: line,
    acts: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {type: 'object', properties: {kind: {enum: KINDS}, anchor: {type: 'string'}, label: {type: 'string'}, line: {type: 'string'}, counter, amount: {type: 'number'}}, required: ['kind', 'anchor', 'label', 'line', 'counter']},
    },
    end: {type: 'object', properties: {line: {type: 'string'}, anchor: {type: 'string'}, title: {type: 'string'}, rewind: {type: 'boolean'}}, required: ['line', 'anchor', 'title', 'rewind']},
  },
  required: ['title', 'accent', 'weather', 'hero', 'voice', 'intro', 'acts', 'end'],
};

const SYSTEM = `You write specs for 36-second vertical "what if" Reels. Every film shows the same low-poly
pastel 3D model city from one slowly moving camera: a river with a bridge (painted in the accent colour),
a park lawn in front, streets with tiny cars, a skyline on the far shore. A calm narrator reads the script.
The film opens on the question, runs three acts that escalate in time and scale, and ends on a dry punchline.

Each act shows exactly ONE visual change from this library (the city is the only stage, pick what makes the idea visible):
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
- title: the question, at most 44 characters, e.g. "What if it snowed for a whole month?"
- act.label: what appears on screen as the act opens, at most 32 characters, digits allowed ("Day 30: servers go dark").
- counter: a number that ticks from 'from' to 'to' during the act, making the change concrete. label at most 20 characters.
  Optional prefix/suffix (e.g. "+", " m", " cm") and decimals. Counters should usually continue from one act to the next.
- end.title: the end card, at most 40 characters. end.rewind = true when the punchline undoes everything (it all snaps back).
- accent and weather should fit the mood (overcast for gloom/rain/flood, golden for warm/crowds, clear otherwise).

Example output for "What if Darsh locked in?":
{"title":"What if Darsh locked in?","accent":"red","weather":"clear","hero":true,"voice":"en-US-AndrewNeural",
"intro":{"line":"What if Darsh actually locked in?","anchor":"What if"},
"acts":[{"kind":"towers","anchor":"Day one","label":"Day 1: phone in a drawer","line":"Day one. His phone goes in a drawer. No reels, no dilly-dallying. Nine straight hours of real work, and the city starts building itself.","counter":{"label":"Hours locked in","from":0,"to":9},"amount":30},
{"kind":"blackout","anchor":"Day thirty","label":"Day 30: a certain website shuts down","line":"Day thirty. A certain website quietly shuts down its servers. Turns out, Darsh was their main user.","counter":{"label":"Servers online","from":4096,"to":0}},
{"kind":"rockets","anchor":"Year one","label":"Year 1: Type II civilization","line":"Year one. The work compounds. Launch pads fill the bay, a rocket goes up every minute, and humanity becomes a Type Two civilization.","counter":{"label":"Kardashev scale","from":0.73,"to":2,"decimals":2,"prefix":"Type "},"amount":10}],
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

The output must match this JSON Schema:
${JSON.stringify(SCHEMA)}

Do not use tools, run commands or edit files. Reply with only the JSON object: no prose, no code fences.

${request}`;

// first balanced {...} in the text that parses as JSON
const extractJson = (text) => {
  const t = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (let i = t.indexOf('{'); i !== -1; i = t.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { const o = JSON.parse(t.slice(i, j + 1)); if (o && o.acts) return o; } catch {}
        break;
      }
    }
  }
  throw new Error('no spec JSON in the agent output');
};

const runAgent = (agent, request, ms = 240000) =>
  new Promise((ok, bad) => {
    const dir = mkdtempSync(join(tmpdir(), 'reel-writer-'));
    const file = join(dir, 'brief.md');
    const text = brief(request);
    writeFileSync(file, text);
    const usesFile = agent.command.includes('{promptFile}');
    const cmd = agent.command.replaceAll('{promptFile}', `"${file}"`);
    const p = spawn(cmd, {cwd: dir, shell: true, windowsHide: true});
    let out = '', err = '';
    const done = () => { clearTimeout(t); rmSync(dir, {recursive: true, force: true}); };
    const t = setTimeout(() => { p.kill(); bad(new Error(`${agent.name} timed out after ${ms / 1000}s. Last output: ${(out + err).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-200)}`)); }, ms);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => (done(), bad(e)));
    p.on('close', (code) => {
      done();
      try {
        let body = out;
        if (agent.mode === 'claude-json') {
          const j = JSON.parse(out);
          if (j.is_error) throw new Error(j.result || 'error');
          body = j.result;
        }
        ok(extractJson(body));
      } catch (e) {
        bad(new Error(`${agent.name} (exit ${code}): ${e.message}. ${(err || out).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-240)}`));
      }
    });
    if (usesFile) p.stdin.end();
    else p.stdin.end(text);
  });

const slugify = (t) => t.toLowerCase().replace(/^what if\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || 'new-film';
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));

// mechanical fields the writer never decides
const finish = (g, slugs) => {
  let slug = slugify(g.title), n = 2;
  const base = slug;
  while (slugs.includes(slug)) slug = `${base}-${n++}`;
  const acts = g.acts.slice(0, 4).map((a, i) => {
    const c = {label: a.counter.label, from: a.counter.from, to: a.counter.to};
    if (a.counter.decimals) c.decimals = a.counter.decimals;
    if (a.counter.prefix) c.prefix = a.counter.prefix;
    if (a.counter.suffix) c.suffix = a.counter.suffix;
    const act = {kind: a.kind, anchor: a.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), label: a.label, line: a.line, counter: c, cam: {...CAMS[i]}};
    if (KIND_RANGE[a.kind]) act.amount = clamp(a.amount ?? KIND_DEFAULT[a.kind][Math.min(i, 2)], KIND_RANGE[a.kind]);
    return act;
  });
  return {
    slug, seed: slug, title: g.title, accent: g.accent, weather: g.weather, hero: g.hero ? 'darsh' : null,
    voice: VOICES.includes(g.voice) ? g.voice : VOICES[0], duration: 36,
    intro: {line: g.intro.line, anchor: g.intro.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), cam0: {x: 0, z: 12}, cam: {x: -0.1, z: 11.5}},
    acts,
    end: {line: g.end.line, anchor: g.end.anchor.replace(/[^\p{L}\p{N}'\s-]/gu, '').trim(), title: g.end.title, rewind: !!g.end.rewind},
  };
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

export async function generate(prompt, {validate, slugs, agentId}) {
  const {agents, selected} = agentConfig();
  const agent = agents.find((a) => a.id === (agentId ?? selected)) ?? agents[0];
  const ask = `Write the spec for: ${prompt.trim()}`;
  let note = null;
  if (agent && !agent.builtin) {
    try {
      let spec = finish(await runAgent(agent, ask), slugs);
      let v = validate(spec);
      if (!v.ok) {
        spec = finish(await runAgent(agent, `${ask}\n\nA previous attempt failed these checks; fix them:\n- ${v.errors.join('\n- ')}\n\nPrevious attempt:\n${JSON.stringify(spec)}`), slugs);
        v = validate(spec);
      }
      return {spec, check: v, source: agent.name};
    } catch (e) {
      note = String(e.message ?? e).slice(0, 400);
    }
  }
  const spec = finish(draft(prompt), slugs);
  return {spec, check: validate(spec), source: 'Offline draft', note};
}
