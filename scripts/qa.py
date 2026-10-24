# QA for a finished film: delivery spec, loudness, safe zones, cover legibility, determinism.
# usage: .venv\Scripts\python scripts/qa.py <slug>   -> prints PASS/FAIL lines, writes out/<slug>/qa_*.png
# Exit code 1 if any check fails.
import hashlib, json, os, re, struct, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPX = 'npx.cmd' if os.name == 'nt' else 'npx'
DEAD_TOP, DEAD_BOTTOM, RAIL_X, RAIL_Y = 220, 1500, 930, 1100
results = []


def check(name, ok, detail):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


def run(*a, **k):
    return subprocess.run(list(a), cwd=ROOT, capture_output=True, text=True, **k)


def frame_png(mp4, n, out):
    run('ffmpeg', '-v', 'error', '-y', '-i', mp4, '-vf', f'select=eq(n\\,{n})', '-frames:v', '1', out, check=True)
    return out


def still(props, n, out):
    run(NPX, 'remotion', 'still', 'out/bundle', 'WhatIf', out, f'--frame={n}', f'--props={props}', '--log=error', check=True)
    return out


def top_atoms(path):
    order, off = [], 0
    with open(path, 'rb') as f:
        size_total = os.path.getsize(path)
        while off < size_total:
            f.seek(off)
            hdr = f.read(16)
            if len(hdr) < 8:
                break
            size, kind = struct.unpack('>I4s', hdr[:8])
            if size == 1:
                size = struct.unpack('>Q', hdr[8:16])[0]
            order.append(kind.decode('latin1'))
            if size == 0:
                break
            off += size
    return order


def main(slug):
    mp4 = os.path.join(ROOT, 'out', f'{slug}.mp4')
    d = os.path.join(ROOT, 'out', slug)
    spec = next(s for s in json.load(open(os.path.join(ROOT, 'ideas.json'), encoding='utf-8')) if s['slug'] == slug)
    events = json.load(open(os.path.join(d, 'events.json')))

    # ---- delivery spec
    p = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4).stdout)
    v = next(s for s in p['streams'] if s['codec_type'] == 'video')
    a = next(s for s in p['streams'] if s['codec_type'] == 'audio')
    dur = float(p['format']['duration'])
    check('resolution', (v['width'], v['height']) == (1080, 1920), f"{v['width']}x{v['height']}")
    check('frame rate', v['r_frame_rate'] == '30/1', v['r_frame_rate'])
    check('video codec', v['codec_name'] == 'h264' and v.get('profile') == 'High' and v['pix_fmt'] == 'yuv420p', f"{v['codec_name']} {v.get('profile')} {v['pix_fmt']}")
    head = open(mp4, 'rb').read(4_000_000)
    crf = re.search(rb'crf=([\d.]+)', head)
    check('crf', bool(crf) and float(crf.group(1)) == 18.0, f"x264 SEI crf={crf.group(1).decode() if crf else '?'}")
    br = int(a.get('bit_rate', 0))
    check('audio codec', a['codec_name'] == 'aac' and a['sample_rate'] == '48000' and 180_000 <= br <= 200_000, f"{a['codec_name']} {a['sample_rate']} Hz {br // 1000} kbps")
    check('duration', abs(dur - spec['duration']) < 0.1 and int(v['nb_frames']) == round(spec['duration'] * 30), f"{dur:.3f}s, {v['nb_frames']} frames")
    atoms = top_atoms(mp4)
    check('faststart', 'moov' in atoms and 'mdat' in atoms and atoms.index('moov') < atoms.index('mdat'), ' '.join(atoms))

    # ---- loudness
    err = run('ffmpeg', '-hide_banner', '-nostats', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-').stderr
    tail = err[err.rfind('Summary:'):]
    I = float(tail.split('I:')[1].split()[0])
    TP = float(tail.split('Peak:')[1].split()[0])
    check('integrated loudness', abs(I + 14) <= 1.0, f'{I:.1f} LUFS (target -14 +/- 1)')
    check('true peak', TP <= -1.5, f'{TP:.1f} dBTP (max -1.5)')

    # ---- safe zones: diff stills with and without text to find every text pixel
    run(NPX, 'remotion', 'bundle', '--out-dir', 'out/bundle', '--log=error', check=True)
    acts = [e for e in events['events'] if e['id'].startswith('act') and e['id'][3:].isdigit()]
    total = events['total']
    samples = [0, acts[0]['fr'] + 30, acts[len(acts) // 2]['fr'] + 120, total - 8]
    tiles = []
    for n in samples:
        t = np.asarray(Image.open(still(f'out/{slug}/props.json', n, os.path.join(d, f'qa_t{n}.png'))).convert('RGB')).astype(int)
        b = np.asarray(Image.open(still(f'out/{slug}/props-notext.json', n, os.path.join(d, f'qa_b{n}.png'))).convert('RGB')).astype(int)
        mask = np.abs(t - b).sum(2) > 24
        ys, xs = np.nonzero(mask)
        dead = mask[:DEAD_TOP].sum() + mask[DEAD_BOTTOM:].sum() + mask[RAIL_Y:, RAIL_X:].sum()
        box = (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None
        check(f'safe zones @f{n}', dead == 0, f'text bbox {box}, {dead} text px in dead zones')
        im = Image.open(frame_png(mp4, n, os.path.join(d, f'qa_f{n}.png'))).convert('RGBA')
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        g = ImageDraw.Draw(ov)
        for r in [(0, 0, 1080, DEAD_TOP), (0, DEAD_BOTTOM, 1080, 1920), (RAIL_X, RAIL_Y, 1080, DEAD_BOTTOM)]:
            g.rectangle(r, fill=(255, 0, 0, 90))
        if box:
            g.rectangle([int(c) for c in box], outline=(0, 255, 0, 255), width=4)
        tiles.append(Image.alpha_composite(im, ov).convert('RGB').resize((360, 640)))
    sheet = Image.new('RGB', (360 * len(tiles), 640))
    for i, tl in enumerate(tiles):
        sheet.paste(tl, (360 * i, 0))
    sheet.save(os.path.join(d, 'qa_safe.png'))

    # ---- cover: frame 0 at phone size, and already moving
    f0 = Image.open(frame_png(mp4, 0, os.path.join(d, 'qa_f0.png'))).convert('RGB')
    f0.resize((300, 533), Image.LANCZOS).save(os.path.join(d, 'qa_cover300.png'))
    f6 = Image.open(frame_png(mp4, 6, os.path.join(d, 'qa_f6.png'))).convert('RGB')
    motion = np.abs(np.asarray(f0).astype(int) - np.asarray(f6).astype(int)).mean()
    check('frame 0 in motion', motion > 0.05, f'mean |f0 - f6| = {motion:.2f}')

    # ---- determinism: the same frames rendered twice must be byte-identical
    same = True
    for n in (samples[1], samples[2]):
        h = [hashlib.md5(open(still(f'out/{slug}/props.json', n, os.path.join(d, f'qa_det{k}.png')), 'rb').read()).hexdigest() for k in (0, 1)]
        same &= h[0] == h[1]
    check('deterministic re-render', same, f'frames {samples[1]}, {samples[2]} rendered twice')

    # ---- sequence vs still: a frame from the MP4 must match the same frame rendered on its own, or the
    # picture depends on render history (stale culling, leftover state)
    worst = 0.0
    for n in samples[1:3] + [round(total * 0.75)]:
        a = np.asarray(Image.open(frame_png(mp4, n, os.path.join(d, f'qa_seq{n}.png'))).convert('RGB')).astype(float)
        b = np.asarray(Image.open(still(f'out/{slug}/props.json', n, os.path.join(d, f'qa_one{n}.png'))).convert('RGB')).astype(float)
        mse = ((a - b) ** 2).mean()
        psnr = 99.0 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
        worst = psnr if worst == 0 else min(worst, psnr)
    check('sequence matches stills', worst > 32, f'worst PSNR {worst:.1f} dB (MP4 frame vs standalone still)')

    print(f"{sum(results)}/{len(results)} checks passed -> {os.path.join(d, 'qa_safe.png')}")
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main(sys.argv[1])
