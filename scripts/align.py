# Word timings and loudness envelope for a voiceover.
# usage: .venv\Scripts\python scripts/align.py <slug>
#   -> out/<slug>/words.json  [{w, s, e}]  faster-whisper word timestamps, spelled as in the script
#   -> out/<slug>/env.json    [0..1 per frame at 30 fps]  VO loudness envelope
# Whisper's spellings ("1" for "one", "Dash" for "Darsh") are mapped back onto the script's words by
# sequence alignment, keeping whisper's timings, so cue('Day one') resolves after any re-record.
import difflib, json, math, os, re, struct, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from make_vo import lines_of, spec_for  # noqa: E402

norm = lambda s: re.sub(r"[^a-z0-9']", '', s.lower())


def main(slug):
    spec = spec_for(slug)
    vo = os.path.join(ROOT, 'public', 'vo', f'{slug}.wav')
    out = os.path.join(ROOT, 'out', slug)
    os.makedirs(out, exist_ok=True)
    script = ' '.join(lines_of(spec)).split()
    names = ', '.join(sorted({w.strip('.,?!') for w in script if w[:1].isupper()}))
    m = WhisperModel('small.en', device='cpu', compute_type='int8')
    # decode with ffmpeg ourselves (faster-whisper's PyAV path breaks on recent av releases)
    pcm16k = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', vo, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout, '<f4')
    segs, _ = m.transcribe(pcm16k, word_timestamps=True, initial_prompt=names, beam_size=5)
    heard = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segs for w in s.words]

    # map heard words onto script words, keeping timings
    a, b = [norm(w['w']) for w in heard], [norm(w) for w in script]
    words = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == 'equal' or (op == 'replace' and i2 - i1 == j2 - j1):
            words += [{'w': script[j1 + k], 's': heard[i1 + k]['s'], 'e': heard[i1 + k]['e']} for k in range(j2 - j1)]
        elif j2 > j1:  # unequal runs: spread the heard span evenly over the script words
            s0 = heard[i1]['s'] if i2 > i1 else (words[-1]['e'] if words else 0.0)
            e0 = heard[i2 - 1]['e'] if i2 > i1 else (heard[i1]['s'] if i1 < len(heard) else s0 + 0.3 * (j2 - j1))
            step = (e0 - s0) / (j2 - j1)
            words += [{'w': script[j1 + k], 's': round(s0 + k * step, 3), 'e': round(s0 + (k + 1) * step, 3)} for k in range(j2 - j1)]
    json.dump(words, open(os.path.join(out, 'words.json'), 'w'), indent=0)
    print(f'{len(heard)} heard, {len(words)} script words; heard: ' + ' '.join(w['w'] for w in heard))

    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', vo, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    n = len(raw) // 2
    s = struct.unpack(f'<{n}h', raw)
    hop = 16000 // 30
    env = [math.sqrt(sum(x * x for x in s[i:i + hop]) / max(1, len(s[i:i + hop]))) for i in range(0, n, hop)]
    peak = sorted(env)[int(len(env) * 0.98)] or 1
    json.dump([round(min(1, e / peak), 3) for e in env], open(os.path.join(out, 'env.json'), 'w'))


if __name__ == '__main__':
    main(sys.argv[1])
