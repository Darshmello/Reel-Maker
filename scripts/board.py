# Stills board: render stills of a film at given seconds from one bundle and lay them out with labels.
# usage: .venv\Scripts\python scripts/board.py <slug> <sec> [sec...]  -> out/<slug>/board/t<sec>.png + board.png
# Needs out/<slug>/props.json (scripts/render.ps1 writes it) and a fresh bundle at out/bundle.
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPX = 'npx.cmd' if os.name == 'nt' else 'npx'


def still(slug, sec, out):
    fr = round(float(sec) * 30)
    subprocess.run([NPX, 'remotion', 'still', 'out/bundle', 'WhatIf', out, f'--frame={fr}', f'--props=out/{slug}/props.json', '--log=error'], cwd=ROOT, check=True)


def main(slug, secs):
    d = os.path.join(ROOT, 'out', slug, 'board')
    os.makedirs(d, exist_ok=True)
    paths = [os.path.join(d, f't{s}.png') for s in secs]
    with ThreadPoolExecutor(2) as ex:
        list(ex.map(lambda a: still(slug, *a), zip(secs, paths)))
    W, cols = 300, 6
    H = round(W * 1920 / 1080)
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * (H + 28)), (18, 18, 20))
    try:
        font = ImageFont.truetype('arial.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (s, p) in enumerate(zip(secs, paths)):
        x, y = (i % cols) * W, (i // cols) * (H + 28)
        sheet.paste(Image.open(p).convert('RGB').resize((W, H)), (x, y + 28))
        ImageDraw.Draw(sheet).text((x + 8, y + 5), f'{float(s):.1f}s  f{round(float(s) * 30)}', fill=(220, 220, 220), font=font)
    out = os.path.join(ROOT, 'out', slug, 'board.png')
    sheet.save(out)
    print(out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
