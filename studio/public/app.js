// Reel Studio front end. Talks to studio/server.mjs; no framework, no build step.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const api = async (path, opts = {}) => {
  const r = await fetch(path, {headers: {'content-type': 'application/json'}, ...opts, body: opts.body && JSON.stringify(opts.body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? j.errors?.[0] ?? r.statusText), {data: j});
  return j;
};

const KIND_INFO = {
  towers: ['Skyline rises', 'Towers shoot up'],
  blackout: ['Blackout', 'A server farm goes dark'],
  rockets: ['Rockets', 'Launch pads fill the bay'],
  water: ['Sea rises', 'The water climbs'],
  crowd: ['Crowds', 'People fill the city'],
  snow: ['Snow', 'Everything turns white'],
  rain: ['Rain', 'Downpour and flooding'],
};
// intensity slider per kind: [min, max, step, defaults for act 1..4]
const AMOUNT = {
  towers: [5, 40, 1, [30, 30, 40, 40]],
  rockets: [1, 20, 1, [6, 10, 14, 18]],
  water: [0.1, 1.2, 0.01, [0.42, 0.8, 1.1, 1.15]],
  crowd: [100, 6000, 100, [700, 2200, 5000, 6000]],
  snow: [0.1, 1, 0.05, [0.45, 1, 1, 1]],
  rain: [0.05, 1, 0.05, [0.15, 0.55, 0.85, 0.95]],
};
const KIND_MORE = {
  towers: 'Good for growth, money, productivity, progress.',
  blackout: 'A server farm with an 18+ sign; its lights go out rack by rack. For a website, app or the internet dying.',
  rockets: 'Launch pads appear in the bay and rockets lift off on smoke. For space, ambition, the far future.',
  water: 'The sea rises over the harbour, then the streets, then all but the rooftops.',
  crowd: 'Tiny people fill the park, then the streets and bridge, then the rooftops.',
  snow: 'Snow falls and covers the city white.',
  rain: 'Rain pours and the streets flood a little.',
};
// camera shots (same table as src/kit/Camera.tsx SHOTS)
const SHOTS = {standard: {}, wide: {h: 4.2, tilt: -11}, aerial: {h: 7.5, tilt: -25}, low: {h: 2.1, tilt: -4}, 'orbit-left': {yaw: 0.38}, 'orbit-right': {yaw: -0.38}};
const SHOT_NAMES = {standard: 'Standard', wide: 'Wide', aerial: 'Aerial', low: 'Low', 'orbit-left': 'Orbit left', 'orbit-right': 'Orbit right'};
const CAMS = [{x: -0.35, z: 10.5}, {x: 0.6, z: 11}, {x: 0, z: 14}, {x: 0.3, z: 12.5}, {x: -0.7, z: 15}];
const VOICES = ['en-US-AndrewNeural', 'en-US-AriaNeural', 'en-US-GuyNeural', 'en-US-JennyNeural', 'en-GB-RyanNeural', 'en-GB-SoniaNeural', 'en-AU-NatashaNeural'];

let DATA = {films: [], palette: {accents: {}, weather: {}}, kinds: []};
let spec = null; // the spec being edited
let touched = {}; // anchor fields the user typed into (otherwise auto from the line)
let editing = null; // slug of the film being edited in place, or null for a new film
let pvAt = 0; // preview position: 0 intro, 1..n acts, n+1 end
let check = null;

const slugify = (t) => t.toLowerCase().replace(/^what if\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || 'new-film';
const autoAnchor = (line) => (line ?? '').replace(/[^\p{L}\p{N}'\s-]/gu, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
const fmtCounter = (c, v) => {
  const d = c.decimals ?? 0;
  const n = Math.abs(v) >= 1e9 && d === 0 ? (v / 1e9).toFixed(v % 1e9 ? 1 : 0) + 'B' : Number(v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
  return `${c.prefix ?? ''}${n}${c.suffix ?? ''}`;
};

// ---------------------------------------------------------------- films
async function load() {
  DATA = await api('/api/films');
  await loadSets();
  renderGrid();
  renderHero();
  renderTemplates();
  renderTemplateDocs();
  $('#navFilms').textContent = DATA.films.filter((f) => f.video).length || '';
  if (!spec) useTemplate(DATA.films[DATA.films.length - 1]?.spec ?? null, false);
  if (DATA.job) showJob(DATA.job);
}

function renderHero() {
  const withVideo = DATA.films.filter((f) => f.video);
  $('#statFilms').textContent = withVideo.length;
  const qa = withVideo.filter((f) => f.qa);
  $('#statQa').textContent = qa.length ? `${qa.filter((f) => f.qa.passed === f.qa.total).length}/${qa.length} pass` : '–';
  const hero = withVideo.find((f) => f.spec.hero) ?? withVideo[0];
  const v = $('#heroVideo');
  if (hero && !v.src.includes(hero.spec.slug)) {
    v.poster = hero.poster ?? '';
    v.src = hero.video;
    v.play().catch(() => {});
    setAccent(hero.spec.accent);
  }
}
$('#heroSound').onclick = (e) => {
  const v = $('#heroVideo');
  v.muted = !v.muted;
  if (!v.muted) { v.currentTime = 0; v.play(); }
  e.currentTarget.textContent = v.muted ? 'Sound off' : 'Sound on';
};

function renderGrid() {
  const pal = DATA.palette;
  $('#grid').innerHTML = DATA.films
    .map(({spec: s, video, poster, qa}, i) => {
      const sky = pal.weather[s.weather] ?? {};
      const qaTag = qa ? `<span class="tag ${qa.passed === qa.total ? 'ok' : 'fail'}">QA ${qa.passed}/${qa.total}</span><span class="tag">${qa.lufs} LUFS</span>` : video ? '' : '<span class="tag">not rendered</span>';
      return `<article class="film" data-i="${i}" tabindex="0">
        <div class="phone" style="background:linear-gradient(${sky.skyTop},${sky.skyHorizon})">
          ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="empty">Not rendered yet</div>`}
          ${video ? `<video muted loop playsinline preload="none" data-src="${video}"></video>` : ''}
        </div>
        <div class="film-meta">
          <h3>${esc(s.title)}</h3>
          <div class="tags"><span class="tag"><i class="dot" style="background:${pal.accents[s.accent]}"></i>${esc(s.accent)}</span><span class="tag">${esc(s.weather)}</span>${qaTag}</div>
          <div class="film-actions">
            <button class="btn ghost sm" data-act="edit">Edit</button>
            <button class="btn ghost sm" data-act="remix">Remix</button>
            <button class="btn ghost sm" data-act="render">${video ? 'Re-render' : 'Render'}</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
  for (const el of document.querySelectorAll('.film')) {
    const f = DATA.films[+el.dataset.i];
    const v = $('video', el);
    if (v) {
      el.onmouseenter = () => { if (!v.src) v.src = v.dataset.src; v.currentTime = 0; v.play().then(() => el.classList.add('playing')).catch(() => {}); };
      el.onmouseleave = () => { v.pause(); el.classList.remove('playing'); };
    }
    el.onclick = (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit') return (useTemplate(f.spec, true), go('#/create'));
      if (act === 'remix') return (useTemplate(f.spec, false), go('#/create'));
      if (act === 'render') return confirmRender(e.target.closest('button'), f.spec.slug, !!f.video);
      if (f.video) openModal(f);
    };
    el.onkeydown = (e) => e.key === 'Enter' && e.target === el && f.video && openModal(f);
  }
}
const go = (route) => (location.hash = route);

// an inline second click instead of a browser dialog
function confirmRender(btn, slug, exists) {
  if (exists && btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    const was = btn.textContent;
    btn.textContent = 'Click to overwrite';
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = was; }, 3000);
    return;
  }
  startRender(slug, false);
}

function openModal(f) {
  const s = f.spec;
  const q = f.qa;
  $('#modalVideo').src = f.video;
  $('#modalVideo').poster = f.poster ?? '';
  $('#modalInfo').innerHTML = `
    <p class="eyebrow">${esc(s.slug)} · ${s.duration}s · ${esc(s.voice.replace('Neural', ''))}</p>
    <h3>${esc(s.title)}</h3>
    <p class="sub">${esc(s.intro.line)}</p>
    <ol class="acts-list">${s.acts.map((a) => `<li><b>${esc(a.label)}</b>${esc(KIND_INFO[a.kind]?.[0] ?? a.kind)} · ${esc(a.counter.label)} ${fmtCounter(a.counter, a.counter.from)} → ${fmtCounter(a.counter, a.counter.to)}</li>`).join('')}
      <li><b>${esc(s.end.title)}</b>End card${s.end.rewind ? ' · rewinds and loops' : ''}</li></ol>
    ${q ? `<dl class="qa-grid"><div><dt>QA</dt><dd>${q.passed}/${q.total}</dd></div><div><dt>Loudness</dt><dd>${q.lufs}</dd></div><div><dt>True peak</dt><dd>${q.tp}</dd></div></dl>` : ''}
    <div class="cta"><a class="btn primary sm" href="${f.video}" download="${esc(s.slug)}.mp4">Download MP4</a><button class="btn ghost sm" id="mRemix">Remix this</button></div>
    <p class="note" style="margin-top:12px">${f.sizeMB} MB · out/${esc(s.slug)}.mp4</p>`;
  $('#mRemix').onclick = () => { closeModal(); useTemplate(s, false); go('#/create'); };
  $('#modal').hidden = false;
  $('#modalVideo').play().catch(() => {});
}
const closeModal = () => { $('#modal').hidden = true; $('#modalVideo').pause(); };
$('#modalClose').onclick = closeModal;
$('#modal').onclick = (e) => e.target.id === 'modal' && closeModal();
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

// ---------------------------------------------------------------- composer
function renderTemplates() {
  $('#template').innerHTML = `<option value="">Blank film</option>` + DATA.films.map((f, i) => `<option value="${i}">${esc(f.spec.title)}</option>`).join('');
}
$('#template').onchange = (e) => useTemplate(e.target.value === '' ? null : DATA.films[+e.target.value].spec, false);

const blank = () => ({
  slug: 'new-film', seed: 'city-new', title: '', accent: 'teal', weather: 'clear', hero: null, voice: VOICES[0], duration: 36,
  intro: {line: '', anchor: '', cam0: {x: 0, z: 12}, cam: {x: -0.1, z: 11.5}},
  acts: [0, 1, 2].map((i) => newAct(i, ['towers', 'crowd', 'rockets'][i])),
  end: {line: '', anchor: '', title: '', rewind: false},
});
function newAct(i, kind = 'towers') {
  const a = {kind, anchor: '', label: '', line: '', counter: {label: '', from: 0, to: 100}, cam: {...CAMS[i % CAMS.length]}};
  if (AMOUNT[kind]) a.amount = AMOUNT[kind][3][i] ?? AMOUNT[kind][3].at(-1);
  return a;
}

function useTemplate(s, inPlace, generated = false) {
  if (!generated) $('#planCard').hidden = true; // a picked/remixed template is not the drafted plan
  spec = structuredClone(s ?? blank());
  editing = inPlace ? spec.slug : null;
  if (!inPlace && s && !generated) {
    spec.title = s.title;
    spec.slug = uniqueSlug(slugify(s.title) + '-remix');
    spec.seed = spec.slug;
  }
  touched = {};
  for (const [k, l] of lineEntries()) touched[k] = !!l.anchor && l.anchor !== autoAnchor(l.line);
  $('#template').value = inPlace || !s || generated ? '' : String(DATA.films.findIndex((f) => f.spec.slug === s.slug));
  pvAt = 0;
  buildForm();
}
const uniqueSlug = (base) => {
  let s = base, n = 2;
  while (DATA.films.some((f) => f.spec.slug === s)) s = `${base}-${n++}`;
  return s;
};
const lineEntries = () => [['intro', spec.intro], ...spec.acts.map((a, i) => [`act${i}`, a]), ['end', spec.end]];

function lineField(key, obj, ph) {
  return `<label class="field"><span>Narration</span><textarea data-k="${key}" data-f="line" rows="2" placeholder="${esc(ph)}">${esc(obj.line)}</textarea></label>
    <div class="anchor">Cue on <input data-k="${key}" data-f="anchor" value="${esc(obj.anchor)}" spellcheck="false"><span class="hint">the words where this beat starts</span></div>`;
}

function buildForm() {
  const pal = DATA.palette;
  $('#title').value = spec.title;
  $('#slug').value = spec.slug;
  $('#seed').value = spec.seed;
  $('#duration').value = spec.duration;
  $('#hero').checked = spec.hero === 'darsh';
  $('#rewind').checked = !!spec.end.rewind;
  $('#endTitle').value = spec.end.title;
  $('#scene').value = spec.scene ?? '';
  renderSetNow();
  $('#voice').innerHTML = [...new Set([...VOICES, spec.voice])].map((v) => `<option ${v === spec.voice ? 'selected' : ''}>${esc(v)}</option>`).join('');
  $('#accents').innerHTML = Object.entries(pal.accents).map(([k, c]) => `<button type="button" class="swatch" title="${k}" aria-label="${k}" aria-pressed="${k === spec.accent}" data-accent="${k}" style="background:${c}"></button>`).join('');
  $('#weather').innerHTML = Object.entries(pal.weather).map(([k, w]) => `<button type="button" class="tile" aria-pressed="${k === spec.weather}" data-weather="${k}" style="background:linear-gradient(${w.skyTop},${w.skyHorizon})"><span>${k}</span></button>`).join('');
  $('[data-line="intro"]').innerHTML = lineField('intro', spec.intro, 'What if it snowed for a whole month?');
  $('[data-line="end"]').innerHTML = lineField('end', spec.end, 'Honestly, it might be the best month this city ever had.');
  buildActs();
  updateMode();
  setAccent(spec.accent);
  refresh();
}

function buildActs() {
  $('#acts').innerHTML = spec.acts
    .map((a, i) => {
      const am = AMOUNT[a.kind];
      return `<fieldset class="card" data-act="${i}">
        <legend><b>${i + 4}</b> Act ${i + 1}${spec.acts.length > 1 ? `<button type="button" class="icon rm" data-rm="${i}" aria-label="Remove act ${i + 1}">Remove</button>` : ''}</legend>
        <div class="kinds">${DATA.kinds.map((k) => `<button type="button" class="kind" data-kind="${k}" aria-pressed="${k === a.kind}">${KIND_INFO[k][0]}<small>${KIND_INFO[k][1]}</small></button>`).join('')}</div>
        <div class="row">
          <label class="field grow"><span>Shot</span><select data-a="shot">${Object.entries(SHOT_NAMES).map(([k, n]) => `<option value="${k}" ${k === (a.shot ?? 'standard') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>On-screen label</span><input data-a="label" value="${esc(a.label)}" maxlength="48" placeholder="Week 1"></label>
        ${lineField(`act${i}`, a, 'Week one. The first flakes fall and the city slows down.')}
        <div class="row">
          <label class="field grow"><span>Counter label</span><input data-c="label" value="${esc(a.counter.label)}" placeholder="Snow depth"></label>
          <label class="field small"><span>From</span><input data-c="from" type="number" step="any" value="${a.counter.from}"></label>
          <label class="field small"><span>To</span><input data-c="to" type="number" step="any" value="${a.counter.to}"></label>
        </div>
        <details class="adv"><summary>Counter format</summary><div class="row">
          <label class="field small"><span>Prefix</span><input data-c="prefix" value="${esc(a.counter.prefix ?? '')}" maxlength="8"></label>
          <label class="field small"><span>Suffix</span><input data-c="suffix" value="${esc(a.counter.suffix ?? '')}" maxlength="8"></label>
          <label class="field small"><span>Decimals</span><input data-c="decimals" type="number" min="0" max="3" value="${a.counter.decimals ?? 0}"></label>
        </div></details>
        ${am ? `<div class="field"><span>Intensity</span><div class="range"><input type="range" data-a="amount" min="${am[0]}" max="${am[1]}" step="${am[2]}" value="${a.amount ?? am[3][i] ?? am[3].at(-1)}"><output>${a.amount ?? am[3][i] ?? am[3].at(-1)}</output></div></div>` : ''}
      </fieldset>`;
    })
    .join('');
  $('#endNo').textContent = spec.acts.length + 4;
  $('#addAct').hidden = spec.acts.length >= 5;
}

function updateMode() {
  const exists = DATA.films.some((f) => f.spec.slug === spec.slug);
  $('#mode').innerHTML = editing && editing === spec.slug ? `Editing <b>${esc(spec.slug)}</b>: saving overwrites it` : exists ? `<b>${esc(spec.slug)}</b> already exists: saving overwrites it` : `New film · out/${esc(spec.slug)}.mp4`;
}

// form events: one delegated handler keeps spec in sync, then refreshes preview + validation
$('#form').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'title') {
    spec.title = t.value;
    if (!editing) { spec.slug = uniqueSlug(slugify(t.value)); spec.seed = spec.slug; $('#slug').value = spec.slug; $('#seed').value = spec.seed; }
  } else if (t.id === 'slug') spec.slug = t.value.trim();
  else if (t.id === 'seed') spec.seed = t.value.trim();
  else if (t.id === 'duration') spec.duration = +t.value;
  else if (t.id === 'voice') spec.voice = t.value;
  else if (t.id === 'hero') spec.hero = t.checked ? 'darsh' : null;
  else if (t.id === 'rewind') spec.end.rewind = t.checked;
  else if (t.id === 'endTitle') spec.end.title = t.value;
  else if (t.id === 'scene') spec.scene = t.value;
  else if (t.dataset.k) {
    const obj = Object.fromEntries(lineEntries())[t.dataset.k];
    obj[t.dataset.f] = t.value;
    if (t.dataset.f === 'anchor') touched[t.dataset.k] = t.value.trim() !== '';
    if (t.dataset.f === 'line' && !touched[t.dataset.k]) {
      obj.anchor = autoAnchor(t.value);
      $(`input[data-k="${t.dataset.k}"]`).value = obj.anchor;
    }
    const act = t.closest('[data-act]');
    if (act) pvAt = +act.dataset.act + 1;
    else pvAt = t.dataset.k === 'intro' ? 0 : spec.acts.length + 1;
  } else {
    const card = t.closest('[data-act]');
    if (!card) return;
    const a = spec.acts[+card.dataset.act];
    pvAt = +card.dataset.act + 1;
    if (t.dataset.a === 'label') a.label = t.value;
    if (t.dataset.a === 'shot') {
      const i = +card.dataset.act;
      a.shot = t.value;
      a.cam = {x: a.cam?.x ?? CAMS[i % CAMS.length].x, z: a.cam?.z ?? CAMS[i % CAMS.length].z, ...SHOTS[t.value]};
    }
    if (t.dataset.a === 'amount') { a.amount = +t.value; t.nextElementSibling.textContent = t.value; }
    if (t.dataset.c) {
      const k = t.dataset.c;
      if (k === 'prefix' || k === 'suffix') t.value ? (a.counter[k] = t.value) : delete a.counter[k];
      else if (k === 'decimals') +t.value ? (a.counter.decimals = +t.value) : delete a.counter.decimals;
      else if (k === 'label') a.counter.label = t.value;
      else a.counter[k] = t.value === '' ? NaN : +t.value;
    }
  }
  if (t.id === 'title' || t.id === 'slug') updateMode();
  refresh();
});
$('#form').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.accent) { spec.accent = b.dataset.accent; setAccent(spec.accent); }
  else if (b.dataset.weather) spec.weather = b.dataset.weather;
  else if (b.dataset.kind) {
    const i = +b.closest('[data-act]').dataset.act;
    const a = spec.acts[i];
    a.kind = b.dataset.kind;
    if (AMOUNT[a.kind]) a.amount = AMOUNT[a.kind][3][i] ?? AMOUNT[a.kind][3].at(-1);
    else delete a.amount;
    pvAt = i + 1;
    buildActs();
  } else if (b.dataset.rm) {
    spec.acts.splice(+b.dataset.rm, 1);
    spec.acts.forEach((a, i) => (a.cam = a.cam ?? {...CAMS[i % CAMS.length]}));
    rekeyTouched();
    pvAt = 0;
    buildActs();
  } else if (b.id === 'addAct') {
    spec.acts.push(newAct(spec.acts.length, 'snow'));
    rekeyTouched();
    pvAt = spec.acts.length;
    buildActs();
  } else return;
  for (const g of ['accent', 'weather']) for (const x of document.querySelectorAll(`[data-${g}]`)) x.setAttribute('aria-pressed', x.dataset[g] === spec[g]);
  refresh();
});
$('#addAct').onclick = (e) => e.preventDefault();
function rekeyTouched() {
  const t = {intro: touched.intro, end: touched.end};
  spec.acts.forEach((a, i) => (t[`act${i}`] = !!a.anchor && a.anchor !== autoAnchor(a.line)));
  touched = t;
}

function setAccent(name) {
  const c = DATA.palette.accents[name];
  if (c) document.documentElement.style.setProperty('--accent', c);
}

// ---------------------------------------------------------------- preview
function drawPreview() {
  const cur = SETS.find((x) => x.id === (spec.set ?? 'city-bridge'));
  const useCover = cur && cur.id !== 'city-bridge' && cur.cover;
  $('#pvArt').style.display = useCover ? 'none' : '';
  $('#pv').style.backgroundImage = useCover ? `url("${cur.cover}")` : '';
  $('#pv').classList.toggle('shot', !!useCover);
  const pal = DATA.palette;
  const sky = pal.weather[spec.weather] ?? {};
  const acc = pal.accents[spec.accent];
  const n = spec.acts.length;
  const act = pvAt >= 1 && pvAt <= n ? spec.acts[pvAt - 1] : null;
  const kind = act?.kind;
  const amt = act?.amount ?? 1;
  const hz = 360;
  const waterTop = kind === 'water' ? hz - amt * 200 : hz;
  const sx = (i) => 60 + i * 74;
  const skyline = Array.from({length: 14}, (_, i) => {
    const h = 40 + ((i * 53) % 90) + (kind === 'towers' ? ((i * 37) % 7) * 46 : 0);
    return `<rect x="${sx(i)}" y="${hz - h}" width="52" height="${h}" fill="#fff" opacity="${0.38 + (i % 3) * 0.12}"/>`;
  }).join('');
  const rockets = kind === 'rockets' ? Array.from({length: Math.min(6, Math.ceil(amt / 2))}, (_, i) => `<g transform="translate(${180 + i * 140} ${hz - 180 - (i % 3) * 160})"><rect x="-9" y="0" width="18" height="70" rx="9" fill="#fff"/><path d="M-9 70 0 120 9 70Z" fill="#FFD58A"/></g>`).join('') : '';
  const crowd = kind === 'crowd' ? Array.from({length: Math.min(160, Math.round(amt / 30))}, (_, i) => `<circle cx="${(i * 97) % 1000 + 40}" cy="${1250 + ((i * 61) % 560)}" r="7" fill="#fff" opacity="0.8"/>`).join('') : '';
  const rain = kind === 'rain' ? Array.from({length: 70}, (_, i) => `<line x1="${(i * 131) % 1080}" y1="${(i * 277) % 1920}" x2="${((i * 131) % 1080) - 18}" y2="${((i * 277) % 1920) + 70}" stroke="#DDE6EE" stroke-width="3" opacity="0.7"/>`).join('') : '';
  const ground = kind === 'snow' ? '#F7F9FB' : pal.grass;
  const blackout = kind === 'blackout' ? `<rect x="640" y="1180" width="300" height="190" fill="#3E444B"/><rect x="660" y="1200" width="260" height="10" fill="#5E6670"/><rect x="660" y="1230" width="260" height="10" fill="#5E6670"/>` : '';
  $('#pvArt').innerHTML = `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.skyTop}"/><stop offset="1" stop-color="${sky.skyHorizon}"/></linearGradient></defs>
    <rect width="1080" height="1920" fill="url(#g)"/>
    ${skyline}${rockets}
    <rect y="${waterTop}" width="1080" height="${1920 - waterTop}" fill="${pal.water}"/>
    <path d="M0 ${hz + 640} L1080 ${hz + 420} L1080 1920 L0 1920Z" fill="${ground}" opacity="${kind === 'water' && amt > 0.7 ? 0 : 1}"/>
    <g stroke="${acc}" stroke-width="16" fill="none" stroke-linecap="round"><path d="M-20 ${hz + 470} L1100 ${hz + 300}"/><path d="M300 ${hz + 436} V${hz + 190} M780 ${hz + 363} V${hz + 117}"/><path d="M40 ${hz + 470} Q300 ${hz + 236} 540 ${hz + 400} Q780 ${hz + 160} 1060 ${hz + 300}" stroke-width="6"/></g>
    ${blackout}${crowd}${rain}
    ${spec.hero ? `<g transform="translate(330 1300)"><rect x="-60" y="40" width="120" height="110" rx="22" fill="#1E1F22"/><circle cx="0" cy="0" r="48" fill="#9C6646"/><circle cx="0" cy="-34" r="44" fill="#1C1816"/><rect x="-80" y="130" width="160" height="12" fill="#D9B8A8"/></g>` : ''}`;
  const isEnd = pvAt === n + 1;
  const title = pvAt === 0 ? spec.title : isEnd ? spec.end.title : act.label;
  $('#pvTitle').textContent = title || (pvAt === 0 ? 'What if …?' : '');
  const c = $('#pvCounter');
  c.hidden = !act;
  if (act) {
    $('b', c).textContent = Number.isFinite(act.counter.to) ? fmtCounter(act.counter, act.counter.to) : '–';
    $('span', c).textContent = act.counter.label || 'Counter';
  }
  $('#scrub').innerHTML = ['Intro', ...spec.acts.map((_, i) => `Act ${i + 1}`), 'End'].map((l, i) => `<button type="button" aria-pressed="${i === pvAt}" data-at="${i}">${l}</button>`).join('');
}
$('#scrub').onclick = (e) => { const b = e.target.closest('[data-at]'); if (b) { pvAt = +b.dataset.at; drawPreview(); } };
$('#zones').onchange = (e) => ($('#pvZones').hidden = !e.target.checked);

// ---------------------------------------------------------------- validation
let timer = 0;
function refresh() {
  drawPreview();
  clearTimeout(timer);
  timer = setTimeout(async () => {
    check = await api('/api/check', {method: 'POST', body: spec}).catch((e) => e.data ?? {ok: false, errors: [e.message]});
    showCheck();
  }, 250);
}
function showCheck() {
  const c = check ?? {errors: []};
  const pct = c.budget ? Math.min(100, (c.words / c.budget) * 100) : 0;
  $('#meterFill').style.width = `${pct}%`;
  $('#meterFill').style.background = pct > 100 || pct >= 99 ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : 'var(--good)';
  $('#meterText').textContent = c.budget ? `Script: ${c.words} of ~${c.budget} words that fit in ${spec.duration}s` : 'Script length appears once the lines are filled in';
  $('#issues').innerHTML = c.ok ? `<li class="ok">Ready. ${c.cues.length} cues resolve in order: ${c.cues.map((q) => `“${esc(q.anchor)}”`).join(', ')}</li>` : (c.errors ?? []).slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join('');
  const busy = DATA.job?.state === 'running';
  $('#save').disabled = !c.ok;
  $('#saveRender').disabled = !c.ok || busy;
  $('#saveRender').textContent = busy ? 'A render is running' : 'Save and render';
}

async function save() {
  const r = await api('/api/films', {method: 'POST', body: spec});
  $('#planCard').hidden = true;
  editing = spec.slug;
  await load();
  updateMode();
  $('#saveNote').textContent = `${r.created ? 'Added to' : 'Updated in'} ideas.json as “${spec.slug}”.`;
  return r;
}
$('#save').onclick = () => save().catch((e) => toast(e.message));
$('#saveRender').onclick = async () => {
  try {
    await save();
    await startRender(spec.slug, $('#keepVo').checked);
  } catch (e) {
    toast(e.message);
  }
};

// ---------------------------------------------------------------- render job
const fmtTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
let clock = 0;
async function startRender(slug, keepVo) {
  try {
    showJob(await api('/api/render', {method: 'POST', body: {slug, keepVo}}));
    $('#dock').hidden = false;
  } catch (e) {
    toast(e.message);
  }
}
function showJob(j) {
  DATA.job = j;
  const film = DATA.films.find((f) => f.spec.slug === j.slug);
  $('#dockTitle').textContent = film?.spec.title ?? j.slug;
  $('#dockState').textContent = j.state === 'running' ? `Rendering · ${j.step}` : j.state === 'done' ? 'Finished' : 'Failed';
  const skipped = j.state !== 'running' ? [] : j.steps.filter((s) => s === 'voiceover' && j.step !== 'voiceover' && !j.done.includes('voiceover'));
  $('#dockSteps').innerHTML = j.steps.map((s) => `<li class="${j.done.includes(s) ? 'done' : skipped.includes(s) ? 'skip' : s === j.step && j.state === 'running' ? 'now' : ''}">${s}</li>`).join('');
  $('#dockTail').textContent = (j.tail ?? []).join('\n');
  $('#dockTail').scrollTop = 1e9;
  const pill = $('#jobPill');
  pill.hidden = false;
  pill.className = `pill ${j.state === 'running' ? '' : j.state}`;
  pill.textContent = j.state === 'running' ? `Rendering ${j.slug}` : j.state === 'done' ? `${j.slug} ready` : `${j.slug} failed`;
  clearInterval(clock);
  const tick = () => ($('#dockTime').textContent = fmtTime((j.endedAt ?? Date.now()) - j.startedAt));
  tick();
  if (j.state === 'running') {
    clock = setInterval(tick, 1000);
    $('#dock').hidden = false;
  }
  showCheck();
}
$('#jobPill').onclick = () => ($('#dock').hidden = !$('#dock').hidden);
$('#dockClose').onclick = () => ($('#dock').hidden = true);
$('#dockLog').onclick = () => { $('#dockTail').hidden = !$('#dockTail').hidden; $('#dockTail').scrollTop = 1e9; };

const es = new EventSource('/api/job/stream');
es.addEventListener('line', (e) => {
  const d = JSON.parse(e.data);
  if (!DATA.job) return;
  DATA.job.tail = [...(DATA.job.tail ?? []), d.line].slice(-200);
  DATA.job.step = d.step;
  DATA.job.done = d.done;
  showJob(DATA.job);
});
es.addEventListener('sets', async (e) => {
  const j = JSON.parse(e.data);
  JOBS.set(j.id, j);
  renderJobs();
  if (j.items.some((i) => i.state !== 'running' && i.state !== 'queued' && !SEEN.has(`${j.id}:${i.setId}`))) {
    for (const i of j.items) if (i.state === 'done' || i.state === 'failed') SEEN.add(`${j.id}:${i.setId}`);
    await loadSets();
  }
});
es.addEventListener('end', async (e) => {
  const j = JSON.parse(e.data);
  showJob(j);
  toast(j.state === 'done' ? `“${j.slug}” is ready` : `“${j.slug}” failed: open the log`);
  await load();
});

let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 4200);
}

load()
  .then(loadAgents)
  .then(route)
  .catch((e) => toast(`Could not reach the studio server: ${e.message}`));

// ---------------------------------------------------------------- routing (#/, #/create, #/films, #/docs/<page>)
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [view, sub] = h ? h.split('/') : ['home'];
  const v = ['create', 'films', 'sets', 'docs'].includes(view) ? view : 'home';
  for (const el of document.querySelectorAll('.view')) el.hidden = el.dataset.view !== v;
  if (v === 'docs') for (const a of document.querySelectorAll('[data-doc]')) a.hidden = a.dataset.doc !== (sub || 'getting-started');
  const here = v === 'docs' ? `#/docs/${sub || 'getting-started'}` : v === 'home' ? '#/' : `#/${v}`;
  for (const a of document.querySelectorAll('.side-nav a')) a.getAttribute('href') === here ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  $('#side').classList.remove('open');
  $('#menu').setAttribute('aria-expanded', 'false');
  const hv = $('#heroVideo');
  if (v === 'home') hv.play().catch(() => {});
  else hv.pause();
  if (!routing) window.scrollTo(0, 0);
}
let routing = false;
window.addEventListener('hashchange', route);
$('#menu').onclick = () => {
  const open = $('#side').classList.toggle('open');
  $('#menu').setAttribute('aria-expanded', String(open));
};

// ---------------------------------------------------------------- agents
let AGENTS = {agents: [], selected: 'claude'};
async function loadAgents() {
  AGENTS = await api('/api/agents');
  const cur = AGENTS.agents.find((a) => a.id === AGENTS.selected) ?? AGENTS.agents[0];
  const opts = AGENTS.agents.map((a) => `<option value="${a.id}" ${a.id === cur?.id ? 'selected' : ''}>${esc(a.name)}${a.installed ? '' : ' (not found)'}</option>`).join('');
  $('#agentPick').innerHTML = opts;
  const keep = $('#setAgent').value;
  $('#setAgent').innerHTML = opts;
  if (AGENTS.agents.some((a) => a.id === keep)) $('#setAgent').value = keep;
  const st = $('#agentStatus');
  st.className = `agent-status ${cur?.installed ? 'ok' : 'bad'}`;
  st.textContent = cur?.builtin ? 'keyword draft, no agent' : cur?.installed ? 'found on PATH' : 'not installed: see Getting started';
  $('#sideAgent').innerHTML = cur ? `<span class="dot ${cur.installed ? '' : 'off'}"></span>Writer: <b>${esc(cur.name)}</b>` : '';
  $('#setupStatus').innerHTML = `<h3>On this computer</h3><div class="status-row">${AGENTS.agents
    .filter((a) => !a.builtin)
    .map((a) => `<span class="tag ${a.installed ? 'ok' : ''}">${a.installed ? '✓' : '–'} ${esc(a.name)}${a.installed ? '' : ' not found'}</span>`)
    .join('')}<span class="tag ok">✓ studio server</span></div>`;
  $('#agentList').innerHTML = AGENTS.agents
    .map((a) => `<div class="agent ${a.id === cur?.id ? 'on' : ''}">
      <h3>${esc(a.name)} <span class="tag ${a.installed ? 'ok' : 'fail'}">${a.builtin ? 'built in' : a.installed ? 'installed' : 'not found'}</span>${a.custom ? '<span class="tag">custom</span>' : ''}</h3>
      <div class="btns">${a.id === cur?.id ? '<span class="tag ok">in use</span>' : `<button class="btn ghost sm" data-use="${a.id}">Use</button>`}${a.custom ? `<button class="btn ghost sm" data-del="${a.id}">Remove</button>` : ''}</div>
      ${a.command ? `<code>${esc(a.command)}</code>` : '<code>No agent: drafts a spec from keywords in your question.</code>'}
    </div>`)
    .join('');
}
$('#agentPick').onchange = async (e) => {
  await api('/api/agents', {method: 'POST', body: {selected: e.target.value}});
  loadAgents();
};
$('#agentList').onclick = async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  await api('/api/agents', {method: 'POST', body: b.dataset.use ? {selected: b.dataset.use} : {remove: b.dataset.del}});
  loadAgents();
};
$('#customAgent').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get('name')).trim();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'custom';
  try {
    await api('/api/agents', {method: 'POST', body: {custom: {id, name, command: String(fd.get('command'))}}});
    e.target.reset();
    toast(`${name} added and selected`);
    loadAgents();
  } catch (err) {
    toast(err.message);
  }
};

// ---------------------------------------------------------------- draft a plan, review it, then generate
let PLAN = null; // the last drafted spec, including the writer's plan/why notes
let drafting = false; // one draft at a time: Ctrl+Enter and the hero form both land here
let logStream = null;
let logSeen = new Set();

const logState = (text, cls = '') => {
  const b = $('#logState');
  b.textContent = text;
  b.className = cls;
};
function openLog(id) {
  closeLog();
  logSeen = new Set();
  $('#logWrap').hidden = false;
  $('#logWrap').open = true;
  const pre = $('#logBody');
  pre.textContent = '';
  logState('connecting', 'live');
  logStream = new EventSource(`/api/log/stream?id=${encodeURIComponent(id)}`);
  const add = (ev) => {
    const key = `${ev.t}|${ev.kind}|${ev.text}`;
    if (logSeen.has(key)) return;
    logSeen.add(key);
    const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 40;
    const line = document.createElement('span');
    line.className = `k-${ev.kind}`;
    line.textContent = `${new Date(ev.t).toTimeString().slice(0, 8)}  ${String(ev.kind).padEnd(8)} ${ev.text}\n`;
    pre.append(line);
    if (stick) pre.scrollTop = pre.scrollHeight;
    if (['command', 'spawn', 'stdout', 'stderr'].includes(ev.kind)) logState('live', 'live');
    if (ev.kind === 'exit') logState('agent exited', 'live');
    if (ev.kind === 'parsed' || ev.kind === 'done') logState(ev.kind, 'done');
    if (ev.kind === 'error') logState('error', 'bad');
    if (ev.kind === 'fallback') logState('offline', 'bad');
    if (ev.kind === 'done' || ev.kind === 'error') {
      const mine = logStream;
      setTimeout(() => {
        if (logStream === mine) closeLog();
      }, 400);
    }
  };
  logStream.addEventListener('log', (e) => {
    try {
      add(JSON.parse(e.data));
    } catch {}
  });
  logStream.addEventListener('hello', () => logState('live', 'live'));
  logStream.onerror = () => {
    closeLog();
    logState('stream closed', '');
  };
}
function closeLog() {
  if (logStream) {
    logStream.close();
    logStream = null;
  }
}
function setBuilding(on, text) {
  $('#building').hidden = !on;
  if (text) $('#buildingText').textContent = text;
  $('#build').disabled = on;
  $('#buildNow').disabled = on;
  $('#composer').classList.toggle('dim', on);
}
const draftId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function build(prompt, direct = false) {
  if (drafting) return; // a writer is already running; ignore the second submit
  prompt = (prompt ?? $('#prompt').value).trim();
  if (!prompt) {
    toast('Write the brief first: a sentence or two about the idea.');
    return $('#prompt').focus();
  }
  drafting = true;
  $('#prompt').value = prompt;
  const agent = AGENTS.agents.find((a) => a.id === $('#agentPick').value);
  const id = draftId();
  $('#planCard').hidden = true;
  $('#buildNote').textContent = '';
  openLog(id);
  const myLog = logStream;
  setBuilding(true, `${agent?.name ?? 'The writer'} is drafting the plan… the log below is live: the command it ran and everything it prints.`);
  const t0 = Date.now();
  try {
    const r = await api('/api/generate', {method: 'POST', body: {prompt, agent: agent?.id, id}});
    if (r.logId && r.logId !== id) {
      closeLog();
      openLog(r.logId);
    }
    PLAN = r.spec;
    const secs = Math.round((Date.now() - t0) / 1000);
    if (direct && $('#autoSets').checked && r.spec.scene) startSets(r.spec.scene, +$('#variants').value, r.spec.slug, 'create');
    $('#buildNote').textContent = r.note
      ? `${agent?.name} didn't answer, so this is an offline draft (${r.note}). Review it, or draft again with another writer.`
      : `Planned by ${r.source} in ${secs}s. ${r.check.ok ? 'All checks pass — read the plan, then generate.' : 'Some checks need a fix; open it in the editor.'}`;
    if (direct) {
      useTemplate(r.spec, false, true);
      $('#composer').scrollIntoView({behavior: 'smooth', block: 'start'});
    } else {
      renderPlan(r);
      $('#planCard').scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  } catch (e) {
    $('#buildNote').textContent = e.message;
  } finally {
    drafting = false;
    setBuilding(false);
    // let the last SSE frames land even when the writer answered in milliseconds
    setTimeout(() => {
      if (logStream === myLog) closeLog();
    }, 900);
  }
}

// the review screen: what the film is, where it happens and every beat, before anything renders
function renderPlan({spec: s, check: c, source}) {
  const setName = (id) => SETS.find((x) => x.id === id)?.name ?? id;
  const kindName = (k) => KIND_INFO[k]?.[0] ?? k;
  const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '–');
  const val = (c, n) => `${esc(c.prefix ?? '')}${fmt(n)}${esc(c.suffix ?? '')}`;
  const beat = (no, body, cls = '') => `<div class="beat ${cls}"><div class="beat-no">${no}</div><div class="beat-body">${body}</div></div>`;
  const acts = s.acts
    .map((a, i) =>
      beat(
        `Act ${i + 1}`,
        `<p class="beat-line">${esc(a.line)}</p>
         <div class="beat-meta"><span>${esc(kindName(a.kind))}</span><span>${esc(a.shot)} shot</span><span>${esc(a.label)}</span>
           <span>${esc(a.counter.label)} ${val(a.counter, a.counter.from)} → ${val(a.counter, a.counter.to)}</span>
           <span>cue “${esc(a.anchor)}”</span></div>
         ${a.why ? `<p class="beat-why">${esc(a.why)}</p>` : ''}`,
      ),
    )
    .join('');
  $('#planCard').innerHTML = `
    <div class="plan-head">
      <h2>${esc(s.title)}</h2>
      <span class="tag ${c.ok ? 'ok' : 'fail'}">${c.ok ? `${c.cues.length} cues resolve in order` : `${c.errors.length} check${c.errors.length === 1 ? '' : 's'} to fix`}</span>
    </div>
    ${s.plan ? `<p class="plan-pitch">${esc(s.plan)}</p>` : ''}
    <div class="plan-facts">
      <span><b>${s.acts.length}</b> act${s.acts.length === 1 ? '' : 's'}</span>
      <span><b>${s.duration}s</b></span>
      <span><b>${c.words ?? '?'}</b> words, fits ${c.budget ?? '?'}</span>
      <span>set <b>${esc(setName(s.set))}</b></span>
      <span>${esc(s.accent)} · ${esc(s.weather)}</span>
      <span>voice <b>${esc(s.voice.replace(/^en-/, '').replace('Neural', ''))}</b></span>
      <span>by <b>${esc(source)}</b></span>
    </div>
    <div class="plan-place">
      <span>The place</span>
      <p>${esc(s.scene ?? 'No new place described — it reuses an installed set.')}</p>
      <p>Plays on <b>${esc(setName(s.set))}</b>.${s.scene ? ' If you build a set for this scene, pick it in the editor and the film will use it.' : ''}</p>
    </div>
    <div class="plan-beats">
      ${beat('Intro', `<p class="beat-line">${esc(s.intro.line)}</p><div class="beat-meta"><span>cue “${esc(s.intro.anchor)}”</span><span>camera pushes in</span></div>`)}
      ${acts}
      ${beat('End', `<p class="beat-line">${esc(s.end.line)}</p><div class="beat-meta"><span>card: ${esc(s.end.title)}</span><span>cue “${esc(s.end.anchor)}”</span><span>${s.end.rewind ? 'rewinds and loops' : 'cuts to black'}</span></div>`, 'end')}
    </div>
    ${c.ok ? '' : `<ul class="issues">${(c.errors ?? []).slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`}
    <div class="plan-actions">
      <button class="btn primary" data-plan="go" type="button" ${c.ok ? '' : 'disabled title="Fix the checks in the editor first"'}>Generate this film</button>
      <button class="btn ghost${c.ok ? '' : ' primary'}" data-plan="edit" type="button">Open in the editor</button>
      <button class="btn ghost" data-plan="again" type="button">Draft again</button>
      <span class="spacer"></span>
      <span class="note">Generating saves it to ideas.json and starts the render (~15–20 min).</span>
    </div>`;
  $('#planCard').hidden = false;
}

$('#planCard').onclick = async (e) => {
  const b = e.target.closest('[data-plan]');
  if (!b || !PLAN) return;
  const what = b.dataset.plan;
  if (what === 'edit') {
    $('#planCard').hidden = true; // the composer owns the spec from here: Generate would undo hand edits
    useTemplate(PLAN, false, true);
    $('#buildNote').textContent = 'Editing the plan. Change any line, act or shot below, then Save and render.';
    $('#composer').scrollIntoView({behavior: 'smooth', block: 'start'});
    return;
  }
  if (what === 'again') {
    const p = $('#prompt').value.trim();
    if (!p) {
      $('#buildNote').textContent = 'Write the brief again first — the box at the top is empty.';
      return $('#prompt').focus();
    }
    $('#planCard').hidden = true;
    PLAN = null;
    return build(p);
  }
  if (what === 'go') {
    if (!PLAN) return;
    const label = b.textContent;
    b.disabled = true;
    b.textContent = 'Saving…';
    try {
      useTemplate(PLAN, false, true);
      await save();
      $('#planCard').hidden = true;
      if ($('#autoSets').checked && PLAN.scene) startSets(PLAN.scene, +$('#variants').value, spec.slug, 'create');
      await startRender(spec.slug, $('#keepVo').checked);
    } catch (err) {
      toast(err.message);
      b.disabled = false;
      b.textContent = label;
    }
  }
};

$('#build').onclick = () => build();
$('#buildNow').onclick = () => build(null, true);
$('#prompt').onkeydown = (e) => (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) && (e.preventDefault(), build());
$('#heroAsk').onsubmit = (e) => {
  e.preventDefault();
  const p = $('#heroPrompt').value.trim();
  go('#/create');
  if (p) build(p);
  else $('#prompt').focus();
};

// ---------------------------------------------------------------- docs bits
function renderTemplateDocs() {
  $('#tplGrid').innerHTML = DATA.films
    .map(({spec: s, poster}, i) => `<div class="tpl">
      <div class="phone">${poster ? `<img src="${poster}" alt="" loading="lazy">` : ''}</div>
      <div><h3>${esc(s.title)}</h3>
        <ol>${s.acts.map((a, j) => `<li><b>Act ${j + 1}</b>${esc(KIND_INFO[a.kind]?.[0] ?? a.kind)}: ${esc(a.label)}</li>`).join('')}<li><b>End</b>${esc(s.end.title)}</li></ol>
        <button class="btn primary sm" data-tpl="${i}">Use this template</button></div>
    </div>`)
    .join('');
}
$('#tplGrid').onclick = (e) => {
  const b = e.target.closest('[data-tpl]');
  if (!b) return;
  useTemplate(DATA.films[+b.dataset.tpl].spec, false);
  go('#/create');
};
$('#kindTable').innerHTML = Object.entries(KIND_INFO)
  .map(([k, [name, what]]) => `<div class="kind-row"><h3>${name}<code>${k}</code></h3><p>${what}. ${KIND_MORE[k]}</p><span>${AMOUNT[k] ? `intensity ${AMOUNT[k][0]}–${AMOUNT[k][1]}` : 'no intensity'}</span></div>`)
  .join('');
for (const pre of document.querySelectorAll('pre.cmd')) {
  const b = document.createElement('button');
  b.className = 'copy';
  b.type = 'button';
  b.textContent = 'Copy';
  b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code').textContent);
      b.textContent = 'Copied';
    } catch {
      b.textContent = 'Select and copy';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1600);
  };
  pre.append(b);
}
for (const tabs of document.querySelectorAll('[data-tabs]')) {
  tabs.querySelector('.tab-bar').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    for (const x of tabs.querySelectorAll('[data-tab]')) x.setAttribute('aria-selected', String(x === b));
    for (const p of tabs.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== b.dataset.tab;
  };
}

// ---------------------------------------------------------------- sets (the marketplace)
let SETS = [];
const JOBS = new Map(); // set generation jobs by id
const JOB_HOME = new Map(); // job id -> 'create' | 'sets'
const SEEN = new Set();
let setFilter = 'all';

async function loadSets() {
  const r = await api('/api/sets');
  SETS = r.sets;
  for (const j of r.jobs) JOBS.set(j.id, j);
  $('#navSets').textContent = SETS.length;
  renderSetGrid();
  renderSetPick();
  renderJobs();
  if (spec) {
    renderSetNow();
    drawPreview();
  }
}

const statusTag = (m) => `<span class="tag ${m.status === 'approved' ? 'ok' : ''}">${m.status}</span>`;
function renderSetGrid() {
  const biomes = [...new Set(SETS.map((m) => m.biome))];
  $('#setFilters').innerHTML = ['all', 'approved', 'draft', ...biomes].map((b) => `<button type="button" aria-pressed="${b === setFilter}" data-f="${esc(b)}">${esc(b)}</button>`).join('');
  const list = SETS.filter((m) => setFilter === 'all' || m.status === setFilter || m.biome === setFilter);
  $('#setGrid').innerHTML = list
    .map((m) => `<article class="set-card" data-id="${m.id}">
      <button class="set-shot" type="button" data-act="open" aria-label="Preview ${esc(m.name)}">${m.cover ? `<img src="${m.cover}" alt="" loading="lazy">` : '<span>no render yet</span>'}</button>
      <div class="set-meta">
        <div class="set-title"><h3>${esc(m.name)}</h3>${statusTag(m)}</div>
        <p>${esc(m.description)}</p>
        <div class="tags"><span class="tag">${esc(m.biome)}</span><span class="tag">by ${esc(m.author)}</span>${m.usedBy.length ? `<span class="tag">${m.usedBy.length} film${m.usedBy.length > 1 ? 's' : ''}</span>` : ''}</div>
        <div class="set-actions">
          <button class="btn primary sm" type="button" data-act="use">Use in a film</button>
          <button class="btn ghost sm" type="button" data-act="status">${m.status === 'approved' ? 'Move to drafts' : 'Approve'}</button>
          ${m.status === 'draft' && !m.usedBy.length ? '<button class="btn ghost sm" type="button" data-act="delete">Delete</button>' : ''}
        </div>
      </div>
    </article>`)
    .join('') || '<p class="note">No sets match.</p>';
}
$('#setFilters').onclick = (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  setFilter = b.dataset.f;
  renderSetGrid();
};
$('#setGrid').onclick = async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const m = SETS.find((x) => x.id === b.closest('[data-id]').dataset.id);
  const act = b.dataset.act;
  try {
    if (act === 'open') return openSet(m);
    if (act === 'use') {
      if (!spec) useTemplate(null, false);
      spec.set = m.id;
      if (!spec.scene) spec.scene = m.description;
      buildForm();
      return go('#/create');
    }
    if (act === 'status') await api('/api/sets/status', {method: 'POST', body: {id: m.id, status: m.status === 'approved' ? 'draft' : 'approved'}});
    if (act === 'delete') {
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1';
        b.textContent = 'Click to delete';
        setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Delete'; }, 3000);
        return;
      }
      await api('/api/sets/delete', {method: 'POST', body: {id: m.id}});
      toast(`Deleted ${m.name}`);
    }
    await loadSets();
  } catch (err) {
    toast(err.message);
  }
};

// set preview: cover and probe side by side, details and the source
const setModal = document.createElement('div');
setModal.className = 'modal';
setModal.hidden = true;
setModal.innerHTML = '<div class="modal-body set-modal"><button class="icon close" aria-label="Close">×</button><div class="set-modal-in"></div></div>';
document.body.append(setModal);
setModal.onclick = (e) => (e.target === setModal || e.target.closest('.close')) && (setModal.hidden = true);
document.addEventListener('keydown', (e) => e.key === 'Escape' && (setModal.hidden = true));
async function openSet(m) {
  const src = await api(`/api/sets/source?id=${m.id}`).catch(() => ({files: {}}));
  $('.set-modal-in', setModal).innerHTML = `
    <div class="shots">
      <figure>${m.cover ? `<img src="${m.cover}" alt="Opening frame">` : ''}<figcaption>Opening frame</figcaption></figure>
      <figure>${m.probe ? `<img src="${m.probe}" alt="Probe frame">` : ''}<figcaption>Probe: blackout, towers, crowd, rockets</figcaption></figure>
    </div>
    <div class="set-info">
      <p class="crumb">src/sets/${esc(m.id)} · ${esc(m.biome)} · by ${esc(m.author)}</p>
      <h3>${esc(m.name)}</h3>
      <p>${esc(m.description)}</p>
      <div class="tags">${statusTag(m)}${m.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      ${m.prompt ? `<p class="note">Built from: “${esc(m.prompt)}”</p>` : ''}
      <div class="tabs" data-tabs><div class="tab-bar">${Object.keys(src.files).map((n, i) => `<button type="button" data-tab="${esc(n)}" aria-selected="${i === 0}">${esc(n)}</button>`).join('')}</div>
      ${Object.entries(src.files).map(([n, t], i) => `<pre class="cmd code" data-panel="${esc(n)}" ${i ? 'hidden' : ''}><code>${esc(t)}</code></pre>`).join('')}</div>
    </div>`;
  const tabs = $('[data-tabs]', setModal);
  $('.tab-bar', tabs).onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    for (const x of tabs.querySelectorAll('[data-tab]')) x.setAttribute('aria-selected', String(x === b));
    for (const p of tabs.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== b.dataset.tab;
  };
  setModal.hidden = false;
}

// create: the current set and the picker
function renderSetNow() {
  const m = SETS.find((x) => x.id === (spec.set ?? 'city-bridge')) ?? SETS[0];
  if (!m) return;
  $('#setNow').innerHTML = `<div class="set-chip">${m.cover ? `<img src="${m.cover}" alt="">` : '<i></i>'}<div><b>${esc(m.name)}</b><span>${esc(m.biome)} · ${m.status}</span></div></div>`;
  for (const b of document.querySelectorAll('#setPick [data-set]')) b.setAttribute('aria-pressed', String(b.dataset.set === m.id));
}
function renderSetPick() {
  $('#setPick').innerHTML = SETS.map((m) => `<button type="button" class="pick" data-set="${m.id}" aria-pressed="${spec && (spec.set ?? 'city-bridge') === m.id}">${m.cover ? `<img src="${m.cover}" alt="">` : '<i></i>'}<span>${esc(m.name)}</span></button>`).join('');
}
$('#setPick').onclick = (e) => {
  const b = e.target.closest('[data-set]');
  if (!b) return;
  spec.set = b.dataset.set;
  renderSetNow();
  refresh();
};

// generation jobs, shown on Create (for this film) and on Sets
async function startSets(request, variants, base, home, agent) {
  try {
    const j = await api('/api/sets/generate', {method: 'POST', body: {request, variants, base, agent: agent ?? $('#agentPick').value}});
    JOBS.set(j.id, j);
    JOB_HOME.set(j.id, home);
    renderJobs();
  } catch (e) {
    toast(e.message);
  }
}
$('#buildSets').onclick = () => {
  const scene = $('#scene').value.trim();
  if (!scene) return $('#scene').focus();
  startSets(`${scene}${spec.title ? ` (for the film: ${spec.title})` : ''}`, +$('#variants').value, spec.slug, 'create');
};
$('#setBuild').onclick = () => {
  const p = $('#setPrompt').value.trim();
  if (!p) return $('#setPrompt').focus();
  startSets(p, +$('#setVariants').value, undefined, 'sets', $('#setAgent').value);
  $('#setPrompt').value = '';
};
$('#setPrompt').onkeydown = (e) => e.key === 'Enter' && $('#setBuild').click();

const STAGE = {queued: 'Queued', writing: 'Writing code', checking: 'Checking + rendering', repairing: 'Fixing errors', reviewing: 'Reviewing its renders'};
function renderJobs() {
  const card = (j, i) => {
    const m = SETS.find((x) => x.id === i.setId);
    const secs = Math.round(((i.endedAt ?? Date.now()) - j.startedAt) / 1000);
    const body = i.state === 'done'
      ? `${m?.cover ? `<img src="${m.cover}" alt="">` : ''}<div><b>${esc(m?.name ?? i.setId)}</b><span>ready in ${Math.floor(secs / 60)}m ${secs % 60}s</span><button class="btn primary sm" type="button" data-use="${i.setId}">Use this set</button></div>`
      : i.state === 'failed'
        ? `<i class="x"></i><div><b>${esc(i.setId)}</b><span class="bad">failed: ${esc((i.errors ?? [])[0] ?? '')}</span></div>`
        : `<i class="spin"></i><div><b>${esc(i.setId)}</b><span>${STAGE[i.stage] ?? esc(i.stage)} · ${Math.floor(secs / 60)}m ${secs % 60}s</span><span class="log">${esc(i.log.at(-1) ?? '')}</span></div>`;
    return `<div class="job ${i.state}">${body}</div>`;
  };
  const list = (home) => [...JOBS.values()].filter((j) => (JOB_HOME.get(j.id) ?? 'sets') === home && j.items.some((i) => i.state !== 'done' || Date.now() - (i.endedAt ?? 0) < 30 * 60e3)).flatMap((j) => j.items.map((i) => card(j, i))).join('');
  $('#setJobsCreate').innerHTML = list('create');
  $('#setJobs').innerHTML = list('sets');
}
setInterval(() => [...JOBS.values()].some((j) => j.items.some((i) => i.state === 'running')) && renderJobs(), 1000);
for (const el of ['#setJobsCreate', '#setJobs']) {
  $(el).onclick = (e) => {
    const b = e.target.closest('[data-use]');
    if (!b) return;
    if (!spec) useTemplate(null, false);
    spec.set = b.dataset.use;
    buildForm();
    go('#/create');
    toast('Set selected for this film');
  };
}

$('#importForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const j = await api('/api/sets/import', {method: 'POST', body: Object.fromEntries(fd)});
    JOBS.set(j.id, j);
    JOB_HOME.set(j.id, 'sets');
    renderJobs();
    toast('Checking your pack…');
  } catch (err) {
    toast(err.message);
  }
};
