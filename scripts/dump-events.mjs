// Resolve a film's cues and sound events with the same beats.ts the picture uses (Node strips the
// types). Fails by name if an anchor phrase is missing from the aligned words.
// usage: node scripts/dump-events.mjs <slug>   -> out/<slug>/events.json (+ prints the cue table)
import {readFileSync, writeFileSync} from 'node:fs';
import {makeBeats} from '../src/film/beats.ts';

const slug = process.argv[2];
const spec = JSON.parse(readFileSync('ideas.json', 'utf8')).find((s) => s.slug === slug);
if (!spec) throw new Error(`no spec "${slug}" in ideas.json`);
const words = JSON.parse(readFileSync(`out/${slug}/words.json`, 'utf8'));
const b = makeBeats(spec, words);
const t = (fr) => `${fr}f ${(fr / 30).toFixed(2)}s`;
console.log(`intro   ${t(b.introAt)}  "${spec.intro.anchor}"`);
for (const a of b.acts) console.log(`act ${a.i}   ${t(a.start)} -> ${t(a.end)}  ${a.kind}  "${a.anchor}"`);
console.log(`end     ${t(b.endStart)} -> ${t(b.total)}  "${spec.end.anchor}"`);
writeFileSync(`out/${slug}/events.json`, JSON.stringify({total: b.total, events: b.events}, null, 1));
console.log(`${b.events.length} events -> out/${slug}/events.json`);
