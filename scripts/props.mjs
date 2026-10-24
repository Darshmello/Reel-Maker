// Write the render props for one film: its spec from ideas.json, its aligned words, its mixed audio.
// usage: node scripts/props.mjs <slug> [--no-text]   -> out/<slug>/props.json (or props-notext.json)
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const [slug, flag] = process.argv.slice(2);
const spec = JSON.parse(readFileSync('ideas.json', 'utf8')).find((s) => s.slug === slug);
if (!spec) throw new Error(`no spec "${slug}" in ideas.json`);
const words = JSON.parse(readFileSync(`out/${slug}/words.json`, 'utf8'));
const audio = existsSync(`public/audio/${slug}.wav`) ? `audio/${slug}.wav` : null;
const text = flag !== '--no-text';
writeFileSync(`out/${slug}/${text ? 'props' : 'props-notext'}.json`, JSON.stringify({spec, words, audio, text}));
