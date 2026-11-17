#!/usr/bin/env python3
"""Share image (1200x630) for every coach: their own before/after and weight loss, so a link to
alvacy.com/<code> shows that coach on Threads, WhatsApp and Instagram instead of Coach AJ.

Reads the same data the site uses: CASES in assets/results.js (the coaches written by hand) and
data/coaches.js (coaches who joined through /join). Writes images/og-coach/<code>.jpg.
Called by scripts/build.py; also runs on its own:  python3 scripts/make_og_coaches.py
Nothing here may stop the build: a coach whose photos or numbers are missing just keeps the default image."""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / 'og-coach'
FONT = ROOT / 'scripts' / 'fonts' / 'Poppins-Bold.ttf'
W, H, SPLIT = 1200, 630, 470
NAVY, ORANGE, PEACH = (23, 37, 84), (249, 115, 22), (253, 186, 116)


def font(size):
    return ImageFont.truetype(str(FONT), size)


def hand_written():
    """CASES in assets/results.js: coach code, photos and first metric (weight) for every coach with a result."""
    text = (ROOT / 'assets' / 'results.js').read_text(encoding='utf-8')
    out = {}
    for m in re.finditer(r"\{coach:'(\w+)',name:'[^']*',before:'([^']+)',after:'([^']+)',\s*m:\[\{from:([\d.]+),to:([\d.]+)", text):
        code, before, after, a, b = m.groups()
        out[code] = dict(before=before, after=after, start=float(a), end=float(b))
    return out


def joined():
    f = ROOT / 'data' / 'coaches.js'
    try:
        m = re.search(r'window\.ALV_EXTRA\s*=\s*(\{.*\})\s*;?\s*$', f.read_text(encoding='utf-8'), re.S)
        coaches = json.loads(m.group(1)).get('coaches', [])
    except Exception:  # noqa: BLE001
        return {}
    out = {}
    for c in coaches:
        kg = next((x for x in c.get('metrics', []) if x.get('k') == 'kg'), None)
        if kg and c.get('before') and c.get('after'):
            out[c['code']] = dict(before='/images/results/' + c['before'], after='/images/results/' + c['after'],
                                  start=float(kg['from']), end=float(kg['to']), name=str(c.get('name', '')))
    return out


def site_names():
    text = (ROOT / 'assets' / 'site.js').read_text(encoding='utf-8')
    return dict(re.findall(r"^    (\w+): \{ name: '([^']+)'", text, flags=re.M))


def face_center(img):
    """Vertical centre of the largest face (0..1), or None. OpenCV is optional."""
    try:
        import os
        import cv2
        import numpy as np
        xml = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if not os.path.exists(xml):
            return None
        gray = cv2.cvtColor(np.array(img.convert('RGB')), cv2.COLOR_RGB2GRAY)
        casc = cv2.CascadeClassifier(xml)
        faces = casc.detectMultiScale(gray, 1.1, 5, minSize=(img.width // 8, img.width // 8))
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            return (y + h / 2) / img.height
    except Exception:  # noqa: BLE001
        pass
    return None


def cover(img, w, h, focus=0.3):
    """Scale to fill w x h, then crop so the face (or the upper third) sits near `focus` of the height."""
    s = max(w / img.width, h / img.height)
    img2 = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    fc = face_center(img)
    cy = (fc if fc is not None else 0.28) * img2.height
    top = int(min(max(cy - focus * h, 0), img2.height - h))
    left = (img2.width - w) // 2
    return img2.crop((left, top, left + w, top + h))


def fmt(v):
    v = round(v, 1)
    return (str(int(v)) if v == int(v) else str(v).replace('.', ','))


def make(code, name, d):
    before = Image.open(ROOT / d['before'].lstrip('/')).convert('RGB')
    after = Image.open(ROOT / d['after'].lstrip('/')).convert('RGB')
    drop = d['start'] - d['end']
    if drop <= 0:
        return False
    im = Image.new('RGB', (W, H), NAVY)
    im.paste(cover(before, SPLIT, H), (0, 0))
    im.paste(cover(after, W - SPLIT, H), (SPLIT, 0))
    # navy fade at the bottom so the big number reads on any photo
    fade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = fade.load()
    for y in range(H):
        a = max(0, (y - 300) / 330)
        for x in range(W):
            px[x, y] = NAVY + (int(235 * a ** 1.4),)
    im = Image.alpha_composite(im.convert('RGBA'), fade)
    dr = ImageDraw.Draw(im)
    dr.text((32, 34), '#transformwithST', font=font(26), fill='white')
    # SESUDAH pill, top right
    dr.rounded_rectangle((1004, 34, 1164, 84), 25, fill=ORANGE)
    dr.text((1084, 59), 'SESUDAH', font=font(21), fill='white', anchor='mm')
    # SEBELUM pill, bottom left
    dr.rounded_rectangle((32, 545, 188, 596), 25, fill=(238, 241, 250))
    dr.text((110, 571), 'SEBELUM', font=font(21), fill=NAVY, anchor='mm')
    # arrow between the photos
    cx, cy = SPLIT, 315
    dr.ellipse((cx - 42, cy - 42, cx + 42, cy + 42), fill=NAVY)
    dr.ellipse((cx - 36, cy - 36, cx + 36, cy + 36), fill=ORANGE)
    dr.line((cx - 15, cy, cx + 13, cy), fill='white', width=6)
    dr.line((cx + 2, cy - 13, cx + 15, cy, cx + 2, cy + 13), fill='white', width=6, joint='curve')
    # the number
    num, big, small = fmt(drop), font(150), font(54)
    nb, kg = dr.textlength(num, font=big), dr.textlength('kg', font=small)
    dash = 38
    total = dash + 14 + nb + 18 + kg
    x0 = SPLIT + (W - SPLIT - total) / 2
    base = 520
    dr.rectangle((x0, base - 88, x0 + dash, base - 76), fill=PEACH)
    dr.text((x0 + dash + 14, base), num, font=big, fill='white', anchor='ls')
    dr.text((x0 + dash + 14 + nb + 18, base), 'kg', font=small, fill='white', anchor='ls')
    dr.text((SPLIT + (W - SPLIT) / 2, 584), f'bareng {name}', font=font(34), fill='white', anchor='mm')
    OUT.mkdir(parents=True, exist_ok=True)
    im.convert('RGB').save(OUT / f'{code}.jpg', quality=86, optimize=True)
    return True


def build(extra_names=None):
    """Make the image for every coach that has photos and a weight result. Returns the codes that got one."""
    names = site_names()
    names.update(extra_names or {})
    done = []
    for code, d in {**hand_written(), **joined()}.items():
        name = names.get(code) or d.get('name')
        if code == 'aj' or not name:
            continue
        try:
            if make(code, name, d):
                done.append(code)
        except Exception as e:  # noqa: BLE001
            print(f'  WARNING: no share image for {code} ({e}); it keeps the default one')
    return done


if __name__ == '__main__':
    for c in build():
        print(f'  images/og-coach/{c}.jpg')
