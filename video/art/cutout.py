"""Cuts the two students out of a white-background FLUX image into separate transparent layers.

    python3 video/art/cutout.py video/art/out/walkers.png video/art/walker

Writes <prefix>-left.png and <prefix>-right.png (RGBA, cropped) and <prefix>.json (their boxes);
when the figures touch (or with --pair), a single <prefix>-pair.png instead. The background is removed by a
flood fill from the image border over near-white pixels, so white details inside the figures
(eyes, paper, a collar) stay opaque. Small islands (a stray plant, specks) are dropped, and the
pair is split at the emptiest column between them.
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

src, prefix = sys.argv[1], sys.argv[2]  # optional third argument: --pair
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape

# 1. Background = near-white pixels connected to the border.
white = (a.min(axis=2) > 226) & (a.max(axis=2) - a.min(axis=2) < 22)
bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if white[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if white[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))
fg = ~bg

# 2. Keep only the large connected figures.
labels = np.zeros((h, w), np.int32)
sizes = []
n = 0
for y0 in range(h):
    for x0 in range(w):
        if fg[y0, x0] and not labels[y0, x0]:
            n += 1
            labels[y0, x0] = n
            q.append((y0, x0))
            count = 0
            while q:
                y, x = q.popleft()
                count += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = n
                        q.append((ny, nx))
            sizes.append(count)
order = np.argsort(sizes)[::-1]
keep = [i + 1 for i in order[:2] if sizes[i] > 0.02 * h * w]
fg = np.isin(labels, keep)

# 3. Soft edge.
alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.copy()
rgba.putalpha(alpha)

# 4. Split: one layer per figure when they are separate; a single "pair" layer when they touch.
meta = {'size': [w, h]}
if len(keep) == 1 or '--pair' in sys.argv:
    ys, xs = np.nonzero(fg)
    box = (max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 5), min(h, ys.max() + 5))
    rgba.crop(box).save(f'{prefix}-pair.png')
    meta['pair'] = [int(v) for v in box]
    with open(f'{prefix}.json', 'w') as f:
        json.dump(meta, f)
    print('pair', box)
    sys.exit(0)
if len(keep) == 2:
    parts = [labels == k for k in keep]
    parts.sort(key=lambda m: np.nonzero(m)[1].mean())
else:
    cols = fg.sum(axis=0)
    mid = slice(int(w * 0.3), int(w * 0.7))
    cut = int(np.argmin(cols[mid]) + w * 0.3)
    left = np.zeros_like(fg)
    left[:, :cut] = True
    parts = [fg & left, fg & ~left]
for name, m in zip(('left', 'right'), parts):
    m_img = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    layer = im.copy()
    layer.putalpha(Image.fromarray(np.minimum(np.asarray(m_img), np.asarray(alpha))))
    ys, xs = np.nonzero(m)
    box = (max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 5), min(h, ys.max() + 5))
    layer.crop(box).save(f'{prefix}-{name}.png')
    meta[name] = [int(v) for v in box]
    print(name, box)
with open(f'{prefix}.json', 'w') as f:
    json.dump(meta, f)
