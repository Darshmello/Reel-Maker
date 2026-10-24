# Mix: placeholder VO + a synthesized music bed + designed effects, timed from the film's own
# events (scripts/dump-events.mjs -> out/<slug>/events.json, the same beats.ts the picture uses).
# Everything here is synthetic (numpy); see README. Loudness is set later by render.ps1 (-14 LUFS).
# usage: .venv\Scripts\python scripts/mix.py <slug>   -> public/audio/<slug>.wav
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp import SR, bp, db, fade, hp, hz, lp, noise, put, read, reverb, soft, stereo, write  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30


def secs(d):  # int() lengths throughout, so envelopes and tones always match
    return np.arange(int(d * SR)) / SR


def tone(f, d, shape='sine', seed=0):
    t = secs(d)
    if shape == 'saw':
        x = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 8))
    elif shape == 'tri':
        x = sum(((-1) ** ((k - 1) // 2)) * np.sin(2 * np.pi * f * k * t) / k ** 2 for k in range(1, 8, 2))
    else:
        x = np.sin(2 * np.pi * f * t)
    return x


def env(n, a, r):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
    return e


def bed(total, seed):
    """Warm pad + soft plucked arpeggio, 84 bpm, Fmaj7 - Am7 - Dm9 - Bbmaj7."""
    rng = np.random.default_rng(abs(hash(seed)) % 2**32)
    out = np.zeros((int(total * SR), 2))
    chords = [['F3', 'A3', 'C4', 'E4'], ['A2', 'E3', 'G3', 'C4'], ['D3', 'F3', 'A3', 'E4'], ['Bb2', 'D3', 'F3', 'A3']]
    bar = 60 / 84 * 4
    for i in range(int(total / bar) + 1):
        ch = chords[i % 4]
        pad = sum(lp(tone(hz(n), bar + 1.0, 'saw'), 900) for n in ch) / 6
        pad *= np.minimum(1, secs(bar + 1.0) / 0.6) * np.minimum(1, (bar + 1.0 - secs(bar + 1.0)) / 0.8)
        put(out, stereo(pad, -0.2) + stereo(pad, 0.2) * 0.8, i * bar, 0.5)
        root = hz(ch[0]) / 2
        put(out, stereo(lp(tone(root, bar, 'tri'), 300) * env(int(bar * SR), 0.05, 1.2)), i * bar, 0.35)
        for k in range(8):  # eighth-note pluck arpeggio
            n = ch[[0, 2, 1, 3, 2, 3, 1, 2][k]]
            f = hz(n) * 2
            p = tone(f, 0.6, 'tri') * env(int(0.6 * SR), 0.003, 0.18)
            put(out, stereo(p, (k % 2) * 0.5 - 0.25), i * bar + k * bar / 8, 0.12 * (0.8 + 0.4 * rng.random()))
    return reverb(out, decay=2.4, wet=0.35, bright=4000)[: len(out)]


def whoosh(d=0.7, up=True, seed=1):
    n = int(d * SR)
    x = noise(n, seed)
    fc = np.linspace(300, 3500, n) if up else np.linspace(3500, 300, n)
    y = np.zeros(n)
    for i in range(0, n, 2400):  # stepped sweep through a band-pass
        y[i:i + 2400] = bp(x[max(0, i - 2400):i + 2400], fc[i] * 0.6, fc[i] * 1.4)[-len(x[i:i + 2400]):]
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return stereo(y * shape)


def chime(f0=hz('A5')):
    d = 2.2
    x = sum(tone(f0 * k, d) * env(int(d * SR), 0.002, 0.9 / k) / k for k in (1, 2.76, 5.4))
    return stereo(x)


def thunk():
    d = 0.35
    t = secs(d)
    x = np.sin(2 * np.pi * (140 - 60 * t / d) * t) * env(len(t), 0.001, 0.06) + lp(noise(len(t), 3), 1200) * env(len(t), 0.001, 0.025) * 0.5
    return stereo(x)


def rumble(d, seed=4):
    n = int(d * SR)
    x = lp(noise(n, seed), 160, 4) * 3
    e = np.minimum(1, np.arange(n) / (0.4 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.6 * SR))
    return stereo(soft(x * e, 1.5))


def click(seed):
    d = 0.06
    x = hp(noise(int(d * SR), seed), 2000) * env(int(d * SR), 0.0005, 0.008)
    return x


def power_down():
    d = 1.6
    t = secs(d)
    f = 220 * np.exp(-2.2 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + lp(noise(len(t), 9), 400) * np.exp(-t * 3) * 0.3
    return stereo(x)


def launch(seed, pan):
    d = 3.0
    n = int(d * SR)
    x = noise(n, seed)
    lo = lp(x, 220, 4) * 2.2
    hi = bp(x, 600, 2600) * 0.35
    e = np.minimum(1, np.arange(n) / (0.15 * SR)) * np.exp(-np.arange(n) / (1.4 * SR))
    return stereo(soft((lo + hi) * e, 1.3), pan)


def ping():
    d = 0.9
    a = tone(hz('E6'), d) * env(int(d * SR), 0.002, 0.15)
    b = tone(hz('B6'), d) * env(int(d * SR), 0.002, 0.2)
    out = np.zeros(int(1.1 * SR))
    out[: len(a)] += a
    out[int(0.12 * SR): int(0.12 * SR) + len(b)] += b
    return stereo(out)


def murmur(d, seed=6):
    n = int(d * SR)
    x = sum(bp(noise(n, seed + k), 300 + 140 * k, 900 + 200 * k) * (1 + 0.5 * np.sin(np.arange(n) / SR * (1.3 + k))) for k in range(4))
    e = np.minimum(1, np.arange(n) / (1.5 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.8 * SR))
    return stereo(x * e * 0.6)


def wind(d, seed=7):
    n = int(d * SR)
    x = bp(noise(n, seed), 250, 1200) * (0.6 + 0.4 * np.sin(np.arange(n) / SR * 0.7))
    e = np.minimum(1, np.arange(n) / (1.5 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.8 * SR))
    return stereo(x * e)


def rain(d, seed=8):
    n = int(d * SR)
    x = hp(noise(n, seed), 1500) * 0.5 + lp(noise(n, seed + 1), 500) * 0.4
    e = np.minimum(1, np.arange(n) / (1.5 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.8 * SR))
    return stereo(x * e)


def water(d, seed=9):
    n = int(d * SR)
    x = lp(noise(n, seed), 600) * (0.7 + 0.3 * np.sin(np.arange(n) / SR * 2.1))
    e = np.minimum(1, np.arange(n) / (1.5 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.8 * SR))
    return stereo(x * e)


def norm(x, peak=-1.0):
    return x * db(peak) / max(1e-9, np.abs(x).max())


def main(slug):
    ev = json.load(open(os.path.join(ROOT, 'out', slug, 'events.json')))
    words = json.load(open(os.path.join(ROOT, 'out', slug, 'words.json')))
    total = ev['total'] / FPS
    n = int(total * SR)
    vo = read(os.path.join(ROOT, 'public', 'vo', f'{slug}.wav'))[:n]
    vo = hp(vo, 80) * db(-1)
    voice = np.zeros((n, 2))
    voice[: len(vo)] = vo

    # bed, ducked by phrase (words closer than 0.6 s merge into one phrase), not per word
    music = norm(bed(total, slug)[:n]) * db(-17)
    phrases = []
    for w in words:
        if phrases and w['s'] - phrases[-1][1] < 0.6:
            phrases[-1][1] = w['e']
        else:
            phrases.append([w['s'], w['e']])
    t = np.arange(n) / SR
    duck = np.ones(n)
    for s, e in phrases:
        duck = np.minimum(duck, np.interp(t, [s - 0.25, s, e, e + 0.35], [1, db(-7), db(-7), 1], left=1, right=1))
    fx = np.zeros((n, 2))
    at = lambda fr: fr / FPS
    rewind = next((e for e in ev['events'] if e['id'] == 'rewind'), None)
    for e in ev['events']:
        w, x = e['what'], e.get('x', 0)
        if e['id'] == 'intro':
            put(fx, norm(chime()) * db(-16), at(e['fr']))
        elif e['id'] == 'end':
            put(fx, norm(chime(hz('E5'))) * db(-19), at(e['fr']))
        elif e['id'].startswith('act'):
            put(fx, norm(whoosh(0.6, True, e['fr'])) * db(-20), at(e['fr']) - 0.35)
        elif w == 'phone into drawer':
            put(fx, norm(thunk()) * db(-14), at(e['fr']))
        elif w == 'buildings rising':
            put(fx, norm(rumble(e['dur'] / FPS)) * db(-20), at(e['fr']))
        elif w == 'server light off':
            put(fx, norm(stereo(click(e['fr']), x)) * db(-24), at(e['fr']))
        elif w == 'power down':
            put(fx, norm(power_down()) * db(-15), at(e['fr']))
        elif w == 'rocket launch':
            put(fx, norm(launch(e['fr'], x)) * db(-21), at(e['fr']))
        elif w == 'water rising':
            put(fx, norm(water(e['dur'] / FPS, e['fr'])) * db(-24), at(e['fr']))
        elif w == 'rain':
            put(fx, norm(rain(e['dur'] / FPS, e['fr'])) * db(-24), at(e['fr']))
        elif w == 'crowd murmur':
            put(fx, norm(murmur(e['dur'] / FPS, e['fr'])) * db(-24), at(e['fr']))
        elif w == 'winter wind':
            put(fx, norm(wind(e['dur'] / FPS, e['fr'])) * db(-24), at(e['fr']))
        elif w == 'rewind':
            put(fx, norm(whoosh(e['dur'] / FPS + 0.2, False, 99)) * db(-15), at(e['fr']))
        elif w == 'phone notification':
            put(fx, norm(ping()) * db(-15), at(e['fr']))
    if rewind:  # tape-stop the bed under the rewind, then it comes back
        r0, r1 = at(rewind['fr']), at(rewind['fr'] + rewind['dur'])
        duck *= np.interp(t, [r0 - 0.05, r0 + 0.2, r1, r1 + 0.6], [1, 0.15, 0.15, 1], left=1, right=1)
    music *= duck[:, None]
    mix = voice + music + fx
    # fade the very end so the loop point is clean
    mix = fade(mix, 0.01, 0.25)
    out = os.path.join(ROOT, 'public', 'audio', f'{slug}.wav')
    write(out, mix, peak=-3.0)
    print(out, f'{total:.2f}s')


if __name__ == '__main__':
    main(sys.argv[1])
