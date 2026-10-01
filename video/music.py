"""Synthesises the 30 s soundtrack: 96 BPM, 12 bars of 4/4 (2.5 s each). Warm, hopeful and
upbeat: a plucked 16th-note arpeggio, pumping pads, syncopated bass, claps and swung hats.

    python3 video/music.py  ->  video/build/music.wav (48 kHz stereo, 16-bit)

Bar 1: filtered intro (pluck + pad) over the opening question.
Bars 2-3: kick on the quarters, the filter opens, a riser and snare build into bar 4.
Bar 4: the drop. Bars 4-8: full groove.
Bar 9: break (drums out, pad swells, reverse riser) for the freeze frame.
Bars 10-11: the drop again, with a counter-melody.
Bar 12: drums out; piano and pluck resolve to the tonic and ring out.
Everything is generated here, so there is nothing to license.
"""
import os
import wave

import numpy as np

SR = 48000
BPM = 96
BEAT = 60 / BPM            # 0.625 s
S16 = BEAT / 4             # a sixteenth
BAR = 4 * BEAT             # 2.5 s
LENGTH = 12 * BAR          # 30 s
N = int(LENGTH * SR) + 2 * SR
rng = np.random.default_rng(11)

# Separate buses so pads and bass can be ducked by the kick (sidechain pump).
BUS = {k: np.zeros((N, 2)) for k in ('drums', 'music', 'pump', 'fx')}
KICKS = []


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(bus, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= N:
        return
    sig = sig[: N - i]
    BUS[bus][i:i + len(sig), 0] += sig * gain * np.sqrt(0.5 * (1 - pan))
    BUS[bus][i:i + len(sig), 1] += sig * gain * np.sqrt(0.5 * (1 + pan))


def onepole(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or a per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def lp2(x, cutoff):
    return onepole(onepole(x, cutoff), cutoff)


def saw(f, t):
    ph = (f * t) % 1.0
    return 2 * ph - 1


# ---------- instruments ----------

def pluck(note, dur=0.32, bright=1.0):
    """Karplus-Strong pluck: a soft, woody synth-guitar."""
    f = midi(note)
    n = int((dur + 0.4) * SR)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period)
    buf = onepole(buf, 2500 + 5000 * bright)
    out = np.empty(n)
    for i in range(n):
        v = buf[i % period]
        out[i] = v
        buf[i % period] = 0.996 * 0.5 * (v + buf[(i + 1) % period])
    t = np.arange(n) / SR
    env = np.minimum(1, (dur + 0.4 - t) / 0.4)
    return out * env * 0.5


def piano(note, dur, vel=0.5):
    f = midi(note)
    t = np.arange(int((dur + 1.5) * SR)) / SR
    tone = np.zeros_like(t)
    for k, amp in enumerate([1.0, 0.5, 0.25, 0.14, 0.07, 0.04], start=1):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        tone += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t * k * 0.8)
    decay = np.exp(-t * (1.3 + f / 1000))
    rel = np.clip((dur + 1.5 - t) / 1.5, 0, 1)
    return tone * decay * np.minimum(1, t / 0.004) * rel * vel * 0.3


def pad(notes, dur, bright=1.0):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for n in notes:
        for det in (-0.09, -0.03, 0.03, 0.09):
            out += saw(midi(n) * 2 ** (det / 12), t + rng.uniform(0, 1))
    out = lp2(out, 900 + 2600 * bright)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.2)
    return out * env * 0.035


def kick(t, gain=1.0):
    KICKS.append(t)
    x = np.arange(int(0.42 * SR)) / SR
    f = 50 + 140 * np.exp(-x * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 6.5)
    click = rng.normal(0, 1, len(x)) * np.exp(-x * 400) * 0.25
    add('drums', np.tanh((body + click) * 1.6) * 0.8 * gain, t)


def clap(t, gain=1.0):
    x = np.arange(int(0.28 * SR)) / SR
    n = rng.normal(0, 1, len(x))
    n = n - lp2(n, 900)                  # band-ish
    n = lp2(n, 6000)
    env = np.zeros_like(x)
    for d in (0, 0.011, 0.022):         # three hand hits
        env += np.where(x >= d, np.exp(-(x - d) * 60), 0)
    env += np.exp(-x * 14) * 0.5
    add('drums', n * env * 0.5 * gain, t, pan=0.05)


def snare(t, gain=1.0):
    x = np.arange(int(0.22 * SR)) / SR
    n = lp2(rng.normal(0, 1, len(x)), 7000) * np.exp(-x * 18)
    body = np.sin(2 * np.pi * 200 * x) * np.exp(-x * 30)
    add('drums', (n * 0.4 + body * 0.3) * gain, t)


def hat(t, gain=1.0, open_=False, pan=-0.25):
    x = np.arange(int((0.22 if open_ else 0.045) * SR)) / SR
    n = rng.normal(0, 1, len(x))
    n = n - onepole(n, 8000)
    add('drums', n * np.exp(-x * (14 if open_ else 80)) * 0.16 * gain, t, pan=pan)


def shaker(t, gain=1.0):
    x = np.arange(int(0.08 * SR)) / SR
    n = rng.normal(0, 1, len(x))
    n = n - onepole(n, 5000)
    add('drums', n * np.minimum(1, x / 0.015) * np.exp(-x * 45) * 0.08 * gain, t, pan=0.35)


def bass(note, t0, dur, gain=1.0):
    f = midi(note)
    x = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x) + 0.12 * saw(f, x)
    env = np.minimum(1, x / 0.006) * np.minimum(1, (dur - x) / 0.03)
    add('pump', np.tanh(lp2(s, 1400) * 1.8) * env * 0.36 * gain, t0)


def riser(t0, dur, gain=1.0):
    x = np.arange(int(dur * SR)) / SR
    n = rng.normal(0, 1, len(x))
    sweep = onepole(n, 300 + 7000 * (x / dur) ** 2)
    add('fx', sweep * (x / dur) ** 2.4 * 0.35 * gain, t0)


def downlifter(t0, dur=1.2):
    x = np.arange(int(dur * SR)) / SR
    n = onepole(rng.normal(0, 1, len(x)), 6000 * (1 - x / dur) ** 2 + 200)
    add('fx', n * np.exp(-x * 2.2) * 0.25, t0)


def impact(t0):
    x = np.arange(int(1.4 * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-x * 9)) / SR) * np.exp(-x * 3.2)
    add('fx', boom * 0.55, t0)
    downlifter(t0)


# ---------- the song ----------
# I - V/7 - vi - IV in C major, brightened with added 9ths: hopeful, not saccharine.
C, D, E, F, G, A = 48, 50, 52, 53, 55, 57
PROG = [
    ('Cadd9', [60, 64, 67, 74], C),
    ('G/B', [59, 62, 67, 74], G),
    ('Am9', [57, 60, 64, 71], A),
    ('Fmaj9', [57, 60, 64, 67], F),
]
CHORDS = [PROG[3], PROG[2], PROG[1]] + [PROG[i % 4] for i in range(8)] + [PROG[0]]
# bars: 1 Fmaj9, 2 Am9, 3 G/B, 4 C (drop), 5 G/B, 6 Am9, 7 Fmaj9, 8 C, 9 G/B, 10 Am9, 11 Fmaj9, 12 C


def arp_pattern(voicing):
    """16th-note arpeggio: up through the chord and back, with a skip for lilt."""
    v = voicing + [voicing[1] + 12]
    order = [0, 1, 2, 4, 3, 2, 1, 2, 0, 1, 2, 4, 3, 4, 2, 1]
    return [v[i] for i in order]


HOOK = {  # a short topline for the drops: (16th index, note)
    'Cadd9': [(0, 79), (3, 76), (6, 74), (8, 76), (11, 72)],
    'G/B': [(0, 74), (3, 71), (6, 74), (8, 79), (12, 78)],
    'Am9': [(0, 76), (3, 72), (6, 71), (8, 72), (11, 76)],
    'Fmaj9': [(0, 77), (3, 76), (6, 72), (10, 74), (12, 76)],
}

for bar, (name, voicing, root) in enumerate(CHORDS):
    t0 = bar * BAR
    last = bar == 11
    intro = bar == 0
    build = bar in (1, 2)
    brk = bar == 8
    drop = 3 <= bar <= 7 or bar in (9, 10)

    # Pads: filtered in the intro, opening through the build, full in the drops.
    bright = {0: 0.1, 1: 0.35, 2: 0.6, 8: 0.5}.get(bar, 1.0)
    if not last:
        level = 0.8 if intro else 0.55 if build else 1.0
        add('pump', pad(voicing, BAR + 0.05, bright), t0, level)
        add('pump', pad([root], BAR + 0.05, bright) * 0.8, t0, level)

    # Pluck arpeggio on 16ths (swung slightly), brighter as the song opens.
    if not last:
        for i, n in enumerate(arp_pattern(voicing)):
            swing = 0.018 if i % 2 else 0.0
            vel = (0.55 if i % 4 == 0 else 0.38) * (0.95 if intro else 0.8 if build else 1.0)
            add('music', pluck(n + 12, 0.25, bright), t0 + i * S16 + swing, vel, pan=0.35 if i % 2 else -0.35)

    # Topline hook in the drops.
    if drop:
        for i, n in HOOK[name]:
            add('music', piano(n, S16 * 3, 0.55), t0 + i * S16, pan=0.1)
            if bar >= 9:  # counter-melody an octave up on the second drop
                add('music', pluck(n + 12, 0.3), t0 + i * S16 + S16 * 2, 0.35, pan=-0.2)

    # Drums.
    if build:
        for b in range(4):
            kick(t0 + b * BEAT, 0.45 if bar == 1 else 0.6)
            shaker(t0 + b * BEAT + BEAT / 2)
        if bar == 2:
            for s in range(8):  # snare build in 8ths then 16ths
                snare(t0 + 2 * BEAT + s * S16, 0.25 + s * 0.08)
            riser(t0, BAR, 1.0)
    if drop:
        for b in range(4):
            kick(t0 + b * BEAT)
            if b in (1, 3):
                clap(t0 + b * BEAT + 0.008)
            hat(t0 + b * BEAT + BEAT / 2 + 0.02, 1.0, open_=True, pan=-0.15)
            for s in (1, 3):
                hat(t0 + b * BEAT + s * S16 + 0.018, 0.55)
            shaker(t0 + b * BEAT)
        if bar in (5, 7, 10):
            kick(t0 + 3.5 * BEAT)
        # Syncopated bass: root, octave pop, fifth, root.
        for s16, off, d in [(0, 0, 3), (3, 12, 1), (6, 7, 2), (8, 0, 3), (11, 12, 1), (14, 7, 2)]:
            bass(root - 12 + off, t0 + s16 * S16, d * S16 * 0.95)
    if bar == 3 or bar == 9:
        impact(t0)
    if brk:
        bass(root - 12, t0, BAR * 0.8, 0.8)
        riser(t0 + BAR * 0.2, BAR * 0.8, 1.1)
        for s in range(8):
            snare(t0 + 2 * BEAT + s * S16, 0.2 + s * 0.09)

    # Ending: piano and pluck resolve on C and ring out; nothing is cut.
    if last:
        for k, n in enumerate([48, 55, 60, 64, 67, 74]):
            add('music', piano(n, BAR * 0.95, 0.5), t0 + k * 0.03, pan=-0.3 + k * 0.12)
        for i, n in enumerate([72, 76, 79, 84]):
            add('music', pluck(n, 0.5), t0 + 0.3 + i * S16 * 2, 0.4, pan=0.3 - i * 0.2)
        kick(t0)
        add('fx', np.zeros(1), t0)

# Sidechain: duck the pump bus on every kick (quick attack, ~200 ms release).
duck = np.ones(N)
for kt in KICKS:
    i = int(kt * SR)
    x = np.arange(int(0.26 * SR)) / SR
    shape = 1 - 0.65 * np.exp(-x / 0.08) * np.minimum(1, x / 0.003 + 0.6)
    j = min(N, i + len(shape))
    duck[i:j] = np.minimum(duck[i:j], shape[: j - i])
BUS['pump'] *= duck[:, None]


def reverb(x, seconds=1.8, mix=0.25):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.empty_like(x)
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-t * 3.6)
        ir = onepole(ir, 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(len(x) + n)))
        wet = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, ch] = x[:, ch] * (1 - mix) + wet * mix
    return out


# A breath before each drop: everything but the riser drops out for the last eighth.
for drop_t in (3 * BAR, 9 * BAR):
    a, b = int((drop_t - BEAT / 2) * SR), int(drop_t * SR)
    for k in ('drums', 'music', 'pump'):
        BUS[k][a:b] *= np.linspace(1, 0.08, b - a)[:, None] ** 0.5

mix = BUS['drums'] * 1.0 + reverb(BUS['music'] * 1.0 + BUS['pump'] * 0.9, mix=0.22) + reverb(BUS['fx'], 2.4, 0.4)
# Gentle tape-style saturation and a limiter-ish ceiling.
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
out = mix[: int(LENGTH * SR)]
out /= np.max(np.abs(out)) / 0.9
fade = int(0.04 * SR)
out[-fade:] *= np.linspace(1, 0, fade)[:, None]

os.makedirs(os.path.join(os.path.dirname(__file__), 'build'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'build', 'music.wav')
with wave.open(path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print(path, f'{len(out) / SR:.2f}s')
