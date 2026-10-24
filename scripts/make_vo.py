# Placeholder voiceover with edge-tts (free, no key), one clip per script line joined with pauses so
# the narration ends ~1.6 s before the film's duration.
# usage: .venv\Scripts\python scripts/make_vo.py <slug>       -> public/vo/<slug>.wav (48 kHz mono)
# A recorded VO at public/vo/<slug>.user.wav (or .mp3) is used instead when present.
import asyncio, json, os, shutil, subprocess, sys, tempfile, wave
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TAIL = 1.6  # seconds of picture after the last word (end card + rewind)
LEAD = 0.2


def spec_for(slug):
    for s in json.load(open(os.path.join(ROOT, 'ideas.json'), encoding='utf-8')):
        if s['slug'] == slug:
            return s
    sys.exit(f'no spec "{slug}" in ideas.json')


def lines_of(spec):
    return [spec['intro']['line'], *[a['line'] for a in spec['acts']], spec['end']['line']]


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return raw


def trim(raw, thresh=200):
    # strip leading/trailing silence edge-tts adds around each clip
    n = len(raw) // 2
    s = memoryview(raw).cast('h')
    a, b = 0, n
    while a < n and abs(s[a]) < thresh:
        a += 1
    while b > a and abs(s[b - 1]) < thresh:
        b -= 1
    a, b = max(0, a - int(0.01 * SR)), min(n, b + int(0.03 * SR))
    return raw[a * 2:b * 2]


async def tts(text, voice, rate, out):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)


def main(slug):
    spec = spec_for(slug)
    os.makedirs(os.path.join(ROOT, 'public', 'vo'), exist_ok=True)
    dst = os.path.join(ROOT, 'public', 'vo', f'{slug}.wav')
    for ext in ('wav', 'mp3', 'm4a'):
        user = os.path.join(ROOT, 'public', 'vo', f'{slug}.user.{ext}')
        if os.path.exists(user):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', user, '-ac', '1', '-ar', str(SR), dst], check=True)
            print('using recorded VO', user)
            return
    target = spec['duration'] - TAIL
    lines = lines_of(spec)
    tmp = tempfile.mkdtemp()
    for rate_pct in (0, 6, 12, 18, 24):
        rate = f'+{rate_pct}%'
        clips = []
        for i, line in enumerate(lines):
            mp3 = os.path.join(tmp, f'{i}_{rate_pct}.mp3')
            asyncio.run(tts(line, spec['voice'], rate, mp3))
            clips.append(trim(pcm(mp3)))
        speech = sum(len(c) for c in clips) / 2 / SR
        gap = (target - LEAD - speech) / (len(clips) - 1)
        if gap >= 0.35:
            break
    gap = min(gap, 1.8)
    out = bytearray(int(LEAD * SR) * 2)
    for i, c in enumerate(clips):
        out += c
        if i < len(clips) - 1:
            out += bytes(int(gap * SR) * 2)
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f'{dst}: speech {speech:.2f}s, gap {gap:.2f}s, rate {rate}, ends {len(out) / 2 / SR:.2f}s of {spec["duration"]}s')


if __name__ == '__main__':
    main(sys.argv[1])
