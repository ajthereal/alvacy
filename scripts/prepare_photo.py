#!/usr/bin/env python3
"""Prepare a client photo for the results page: crop to 4:5, shrink to web size, add a small watermark.

    python3 scripts/prepare_photo.py ORIGINAL.jpg images/results/name-before.jpg --corner left
    python3 scripts/prepare_photo.py ORIGINAL.jpg images/results/name-after.jpg  --corner right

Always start from the original file, never from an already watermarked copy.
Before photos use --corner left and after photos use --corner right, so both marks stay visible
when the comparison line sits in the middle. Photos are limited to 900 px wide on purpose:
good enough for the page, too small to reuse in print or ads.
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

FONT = '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'
MARK = '#transformwithST'


def prepare(src, dst, corner, width=900, top=None):
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w, h = im.size
    ch = round(w * 5 / 4)
    if h > ch:  # taller than 4:5, keep the top (heads) unless a start row is given
        y = 0 if top is None else max(0, min(h - ch, top))
        im = im.crop((0, y, w, y + ch))
    if im.size[0] > width:
        im = im.resize((width, round(width * im.size[1] / im.size[0])), Image.LANCZOS)
    w, h = im.size
    size = max(14, round(w * 0.05))
    font = ImageFont.truetype(FONT, size)
    pad = round(w * 0.04)
    x0, y0, x1, y1 = font.getbbox(MARK)
    tw, th = x1 - x0, y1 - y0
    x = pad if corner == 'left' else w - pad - tw
    y = h - pad - th - y0
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x, y + 1), MARK, font=font, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, size * 0.09)))
    text = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(text).text((x, y), MARK, font=font, fill=(255, 255, 255, 170))
    out = Image.alpha_composite(Image.alpha_composite(im.convert('RGBA'), shadow), text).convert('RGB')
    out.save(dst, quality=84, optimize=True, progressive=True)
    return out.size


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--corner', choices=['left', 'right'], required=True)
    ap.add_argument('--top', type=int, default=None, help='first row to keep when cropping a tall photo')
    a = ap.parse_args()
    print(a.dst, prepare(a.src, a.dst, a.corner, top=a.top))
