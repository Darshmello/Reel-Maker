// Reel Studio: a local front end for the pipeline. Zero dependencies (node:http only), bound to
// 127.0.0.1. Lists films, edits ideas.json, validates a spec with the same beats.ts the picture uses,
// runs scripts/render.ps1 (one job at a time: renders share the GPU) and streams its log over SSE.
// usage: npm run studio   -> http://127.0.0.1:4321
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream, existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {makeCue} from '../src/film/beats.ts';
import {agentConfig, generate, installed, saveAgentConfig} from './generate.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PUB = join(ROOT, 'studio', 'public');
const IDEAS = join(ROOT, 'ideas.json');
const PORT = Number(process.env.PORT ?? 4321);
const KINDS = ['towers', 'blackout', 'rockets', 'water', 'crowd', 'snow', 'rain'];
const STEPS = ['voiceover', 'align', 'cues + events', 'mix', 'props', 'render', 'loudnorm', 'qa'];
const TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml'};

const readIdeas = () => JSON.parse(readFileSync(IDEAS, 'utf8'));
const writeIdeas = (ideas) => writeFileSync(IDEAS, JSON.stringify(ideas, null, 2) + '\n');

// ---- palette.ts is the single source of colour: read accents and weather skies from it
const palette = () => {
  const src = readFileSync(join(ROOT, 'src/style/lowpoly/palette.ts'), 'utf8');
  const block = (name) => src.slice(src.indexOf(`export const ${name}`), src.indexOf('} as const', src.indexOf(`export const ${name}`)));
  const base = Object.fromEntries([...block('PALETTE').matchAll(/^\s+(\w+): '(#[0-9A-Fa-f]{6})'/gm)].map((m) => [m[1], m[2]]));
  const accents = Object.fromEntries([...block('ACCENTS').matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
  const weather = {};
  for (const m of block('WEATHER').matchAll(/(\w+): \{([^}]*)\}/g)) {
    const val = (k) => {
      const v = m[2].match(new RegExp(`${k}: (?:'(#[0-9A-Fa-f]{6})'|PALETTE\\.(\\w+))`));
      return v ? v[1] ?? base[v[2]] : undefined;
    };
    weather[m[1]] = {skyTop: val('skyTop'), skyHorizon: val('skyHorizon')};
  }
  return {accents, weather, grass: base.grass, water: base.water, bridge: base.bridge};
};

// ---- QA summary from the newest render log (batch logs are UTF-16, studio logs UTF-8)
const decode = (buf) => (buf[0] === 0xff && buf[1] === 0xfe) || buf.indexOf(0) !== -1 ? buf.toString('utf16le') : buf.toString('utf8');
const qaOf = (slug) => {
  const logs = [`${slug}.studio.log`, `${slug}.master.log`, `${slug}.log`].map((n) => join(ROOT, 'out', n)).filter(existsSync);
  logs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const p of logs) {
    const t = decode(readFileSync(p));
    const c = [...t.matchAll(/(\d+)\/(\d+) checks passed/g)].pop();
    if (!c) continue;
    const num = (re) => Number([...t.matchAll(re)].pop()?.[1]);
    return {passed: +c[1], total: +c[2], lufs: num(/integrated loudness: (-?[\d.]+)/g), tp: num(/true peak: (-?[\d.]+)/g)};
  }
  return null;
};

const films = () =>
  readIdeas().map((s) => {
    const mp4 = join(ROOT, 'out', `${s.slug}.mp4`);
    const has = existsSync(mp4);
    return {
      spec: s,
      video: has ? `/media/${s.slug}.mp4?v=${Math.round(statSync(mp4).mtimeMs)}` : null,
      poster: existsSync(join(ROOT, 'out', s.slug, 'qa_cover300.png')) ? `/media/${s.slug}/poster` : null,
      renderedAt: has ? statSync(mp4).mtimeMs : null,
      sizeMB: has ? +(statSync(mp4).size / 1e6).toFixed(1) : null,
      qa: has ? qaOf(s.slug) : null,
    };
  });

// ---- spec validation: shape, then every anchor resolves exactly once and in script order, using
// beats.ts's own cue matcher over the script's words (align.py maps the VO back onto these words)
const validate = (s) => {
  const errors = [];
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s?.slug ?? '')) errors.push('slug: lowercase words joined by dashes');
  for (const k of ['seed', 'title', 'voice']) if (!str(s?.[k])) errors.push(`${k} is required`);
  const pal = palette();
  if (!(s?.accent in pal.accents)) errors.push(`accent must be one of ${Object.keys(pal.accents).join(', ')}`);
  if (!(s?.weather in pal.weather)) errors.push(`weather must be one of ${Object.keys(pal.weather).join(', ')}`);
  if (!(s?.duration >= 15 && s?.duration <= 90)) errors.push('duration: 15-90 s');
  if (!Array.isArray(s?.acts) || s.acts.length < 1 || s.acts.length > 4) errors.push('1-4 acts');
  if (errors.length) return {ok: false, errors, cues: []};
  const lines = [s.intro, ...s.acts, s.end];
  lines.forEach((l, i) => {
    const who = i === 0 ? 'intro' : i === lines.length - 1 ? 'end' : `act ${i}`;
    if (!str(l?.line)) errors.push(`${who}: narration line is required`);
    if (!str(l?.anchor)) errors.push(`${who}: anchor phrase is required`);
    if (i > 0 && i < lines.length - 1) {
      if (!KINDS.includes(l.kind)) errors.push(`${who}: kind must be one of ${KINDS.join(', ')}`);
      if (!str(l.label)) errors.push(`${who}: on-screen label is required`);
      if (!str(l.counter?.label) || !Number.isFinite(l.counter?.from) || !Number.isFinite(l.counter?.to)) errors.push(`${who}: counter needs a label, from and to`);
    }
  });
  if (!str(s.end?.title)) errors.push('end: card title is required');
  if (errors.length) return {ok: false, errors, cues: []};
  const words = lines.flatMap((l) => l.line.split(/\s+/).filter(Boolean)).map((w, i) => ({w, s: i, e: i + 1}));
  const cue = makeCue(words);
  const cues = [];
  let last = -1;
  lines.forEach((l, i) => {
    const who = i === 0 ? 'intro' : i === lines.length - 1 ? 'end' : `act ${i}`;
    try {
      const at = cue(l.anchor);
      if (at <= last) errors.push(`${who}: anchor "${l.anchor}" comes before the previous one`);
      last = at;
      cues.push({who, anchor: l.anchor, word: at});
    } catch (e) {
      errors.push(`${who}: ${e.message.replace('pass nth', 'make the anchor longer so it is unique')}`);
    }
  });
  const nWords = words.length;
  // edge-tts reads ~2.6 words/s at +0%; make_vo.py can speed up to +24%, but keep headroom for pauses
  const budget = Math.round((s.duration - 2.5) * 2.6 * 1.1);
  if (nWords > budget) errors.push(`script is ${nWords} words; ${s.duration} s fits about ${budget}`);
  return {ok: errors.length === 0, errors, cues, words: nWords, budget};
};

// ---- the one render job
let job = null;
const clients = new Set();
const send = (ev, data) => {
  for (const res of clients) res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
};
const jobView = () => job && {slug: job.slug, state: job.state, step: job.step, done: job.done, startedAt: job.startedAt, endedAt: job.endedAt, steps: STEPS, tail: job.lines.slice(-200)};

const startRender = (slug, keepVo) => {
  const log = join(ROOT, 'out', `${slug}.studio.log`);
  job = {slug, state: 'running', step: STEPS[keepVo ? 1 : 0], done: [], lines: [], startedAt: Date.now(), endedAt: null};
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/render.ps1', slug];
  if (keepVo) args.push('-KeepVo');
  const p = spawn('powershell.exe', args, {cwd: ROOT, windowsHide: true});
  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    const parts = buf.split(/\r?\n/);
    buf = parts.pop();
    for (const line of parts) {
      if (!line.trim()) continue;
      job.lines.push(line);
      const m = line.match(/^\[\d\d:\d\d:\d\d\] (.+?) \(\d+s\)$/);
      if (m) {
        const name = STEPS.find((st) => m[1].startsWith(st));
        if (name && !job.done.includes(name)) job.done.push(name);
        job.step = STEPS.find((st) => !job.done.includes(st) && !(keepVo && st === 'voiceover')) ?? 'qa';
      }
      send('line', {line, step: job.step, done: job.done});
    }
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('close', (code) => {
    job.state = code === 0 ? 'done' : 'failed';
    job.endedAt = Date.now();
    writeFileSync(log, job.lines.join('\n') + '\n');
    send('end', jobView());
  });
};

// ---- http
const json = (res, code, body) => {
  res.writeHead(code, {'content-type': 'application/json'});
  res.end(JSON.stringify(body));
};
const body = (req) =>
  new Promise((ok, bad) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        ok(JSON.parse(b || '{}'));
      } catch (e) {
        bad(e);
      }
    });
  });
const file = (req, res, p, type) => {
  if (!existsSync(p)) return json(res, 404, {error: 'not found'});
  const size = statSync(p).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? +range[1] : size - +range[2];
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, {'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1});
    return createReadStream(p, {start, end}).pipe(res);
  }
  res.writeHead(200, {'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache'});
  createReadStream(p).pipe(res);
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  // this server runs commands: only answer this page. Host blocks DNS rebinding; Origin + JSON body
  // block cross-site posts (a JSON content type forces a CORS preflight that is never answered)
  const ok = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
  if (!ok.includes(req.headers.host)) return json(res, 403, {error: 'bad host'});
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if ((origin && !ok.some((h) => origin === `http://${h}`)) || !String(req.headers['content-type']).startsWith('application/json')) return json(res, 403, {error: 'bad origin'});
  }
  try {
    if (path === '/api/agents' && req.method === 'GET') {
      const {agents, selected} = agentConfig();
      return json(res, 200, {selected, agents: agents.map((a) => ({id: a.id, name: a.name, command: a.command ?? null, builtin: !!a.builtin, custom: !!a.custom, installed: installed(a)}))});
    }
    if (path === '/api/agents' && req.method === 'POST') {
      const b = await body(req);
      const {local, agents} = agentConfig();
      if (b.selected && agents.some((a) => a.id === b.selected)) saveAgentConfig({selected: b.selected});
      if (b.custom) {
        const {id, name, command} = b.custom;
        if (!/^[a-z0-9-]{1,32}$/.test(id ?? '') || !String(name ?? '').trim() || !String(command ?? '').trim()) return json(res, 400, {error: 'custom agent needs an id (a-z, 0-9, -), a name and a command'});
        saveAgentConfig({custom: [...(local.custom ?? []).filter((a) => a.id !== id), {id, name: name.trim(), command: command.trim()}], selected: id});
      }
      if (b.remove) saveAgentConfig({custom: (local.custom ?? []).filter((a) => a.id !== b.remove), selected: local.selected === b.remove ? 'claude' : local.selected});
      return json(res, 200, {ok: true});
    }
    if (path === '/api/generate' && req.method === 'POST') {
      const {prompt, agent} = await body(req);
      if (!String(prompt ?? '').trim()) return json(res, 400, {error: 'write a prompt first'});
      const r = await generate(String(prompt).slice(0, 500), {validate, slugs: readIdeas().map((s) => s.slug), agentId: agent});
      return json(res, 200, r);
    }
    if (path === '/api/films' && req.method === 'GET') return json(res, 200, {films: films(), palette: palette(), kinds: KINDS, job: jobView()});
    if (path === '/api/check' && req.method === 'POST') return json(res, 200, validate(await body(req)));
    if (path === '/api/films' && req.method === 'POST') {
      const s = await body(req);
      const v = validate(s);
      if (!v.ok) return json(res, 400, v);
      if (job?.state === 'running' && job.slug === s.slug) return json(res, 409, {errors: ['that film is rendering right now']});
      const ideas = readIdeas();
      const i = ideas.findIndex((x) => x.slug === s.slug);
      if (i >= 0) ideas[i] = s;
      else ideas.push(s);
      writeIdeas(ideas);
      return json(res, 200, {ok: true, created: i < 0});
    }
    if (path === '/api/render' && req.method === 'POST') {
      const {slug, keepVo} = await body(req);
      if (job?.state === 'running') return json(res, 409, {error: `already rendering ${job.slug}`});
      if (!readIdeas().some((s) => s.slug === slug)) return json(res, 404, {error: `no film "${slug}" in ideas.json`});
      startRender(slug, !!keepVo);
      return json(res, 200, jobView());
    }
    if (path === '/api/job/stream') {
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'});
      res.write(`event: hello\ndata: ${JSON.stringify(jobView())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    let m = path.match(/^\/media\/([a-z0-9-]+)\.mp4$/);
    if (m) return file(req, res, join(ROOT, 'out', `${m[1]}.mp4`), 'video/mp4');
    m = path.match(/^\/media\/([a-z0-9-]+)\/poster$/);
    if (m) return file(req, res, join(ROOT, 'out', m[1], 'qa_cover300.png'), 'image/png');
    const p = join(PUB, path === '/' ? 'index.html' : path);
    if (!p.startsWith(PUB) || !existsSync(p) || statSync(p).isDirectory()) return json(res, 404, {error: 'not found'});
    return file(req, res, p, TYPES[extname(p)] ?? 'application/octet-stream');
  } catch (e) {
    return json(res, 500, {error: String(e.message ?? e)});
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Reel Studio -> http://127.0.0.1:${PORT}`));
