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
const CAMS = [{x: -0.35, z: 10.5}, {x: 0.6, z: 11}, {x: 0, z: 14}, {x: 0.3, z: 12.5}];
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
  renderGrid();
  renderHero();
  renderTemplates();
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
      if (act === 'edit') return (useTemplate(f.spec, true), go('#studio'));
      if (act === 'remix') return (useTemplate(f.spec, false), go('#studio'));
      if (act === 'render') return confirmRender(e.target.closest('button'), f.spec.slug, !!f.video);
      if (f.video) openModal(f);
    };
    el.onkeydown = (e) => e.key === 'Enter' && e.target === el && f.video && openModal(f);
  }
}
const go = (sel) => $(sel).scrollIntoView({behavior: 'smooth'});

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
  $('#mRemix').onclick = () => { closeModal(); useTemplate(s, false); go('#studio'); };
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
  const a = {kind, anchor: '', label: '', line: '', counter: {label: '', from: 0, to: 100}, cam: {...CAMS[i]}};
  if (AMOUNT[kind]) a.amount = AMOUNT[kind][3][i];
  return a;
}

function useTemplate(s, inPlace) {
  spec = structuredClone(s ?? blank());
  editing = inPlace ? spec.slug : null;
  if (!inPlace && s) {
    spec.title = s.title;
    spec.slug = uniqueSlug(slugify(s.title) + '-remix');
    spec.seed = spec.slug;
  }
  touched = {};
  for (const [k, l] of lineEntries()) touched[k] = !!l.anchor && l.anchor !== autoAnchor(l.line);
  $('#template').value = inPlace || !s ? '' : String(DATA.films.findIndex((f) => f.spec.slug === s.slug));
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
        <legend><b>${i + 3}</b> Act ${i + 1}${spec.acts.length > 1 ? `<button type="button" class="icon rm" data-rm="${i}" aria-label="Remove act ${i + 1}">Remove</button>` : ''}</legend>
        <div class="kinds">${DATA.kinds.map((k) => `<button type="button" class="kind" data-kind="${k}" aria-pressed="${k === a.kind}">${KIND_INFO[k][0]}<small>${KIND_INFO[k][1]}</small></button>`).join('')}</div>
        <label class="field"><span>On-screen label</span><input data-a="label" value="${esc(a.label)}" maxlength="48" placeholder="Week 1"></label>
        ${lineField(`act${i}`, a, 'Week one. The first flakes fall and the city slows down.')}
        <div class="row">
          <label class="field grow"><span>Counter label</span><input data-c="label" value="${esc(a.counter.label)}" placeholder="Snow depth"></label>
          <label class="field small"><span>From</span><input data-c="from" type="number" step="any" value="${a.counter.from}"></label>
          <label class="field small"><span>To</span><input data-c="to" type="number" step="any" value="${a.counter.to}"></label>
          <label class="field small"><span>Prefix</span><input data-c="prefix" value="${esc(a.counter.prefix ?? '')}" maxlength="8"></label>
          <label class="field small"><span>Suffix</span><input data-c="suffix" value="${esc(a.counter.suffix ?? '')}" maxlength="8"></label>
          <label class="field small"><span>Decimals</span><input data-c="decimals" type="number" min="0" max="3" value="${a.counter.decimals ?? 0}"></label>
        </div>
        ${am ? `<div class="field"><span>Intensity</span><div class="range"><input type="range" data-a="amount" min="${am[0]}" max="${am[1]}" step="${am[2]}" value="${a.amount ?? am[3][i]}"><output>${a.amount ?? am[3][i]}</output></div></div>` : ''}
      </fieldset>`;
    })
    .join('');
  $('#endNo').textContent = spec.acts.length + 3;
  $('#addAct').hidden = spec.acts.length >= 4;
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
    if (AMOUNT[a.kind]) a.amount = AMOUNT[a.kind][3][i];
    else delete a.amount;
    pvAt = i + 1;
    buildActs();
  } else if (b.dataset.rm) {
    spec.acts.splice(+b.dataset.rm, 1);
    spec.acts.forEach((a, i) => (a.cam = a.cam ?? {...CAMS[i]}));
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

load().catch((e) => toast(`Could not reach the studio server: ${e.message}`));
