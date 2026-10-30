import pathlib, sys

BLUE, GREEN = "#1f2d66", "#5aa897"
NEUTRAL_L, NEUTRAL_D = "#eeefeb", "#121416"
TINT_L = [0.0, 0.10, 0.22, 0.40]
TINT_D = [0.0, 0.30, 0.60, 0.90]
LIGHT_TINT, DARK_TINT = 1, 2
TOKENS = ["bg", "fg", "muted", "rule", "accent", "slot", "display", "spin-up", "spin-down"]

def hex2rgb(h): return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def rgb2hex(c): return "#" + "".join(f"{round(min(1, max(0, x)) * 255):02x}" for x in c)
def lin(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
def delin(x): return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
def to_oklab(h):
    r, g, b = map(lin, hex2rgb(h))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
def from_oklab(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    return rgb2hex([delin(max(0, x)) for x in rgb])
def mix(a, b, t):
    A, B = to_oklab(a), to_oklab(b)
    return from_oklab(*[x + (y - x) * t for x, y in zip(A, B)])
def lum(h): r, g, b = map(lin, hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def ratio(a, b): x, y = sorted([lum(a), lum(b)], reverse=True); return (x + 0.05) / (y + 0.05)

def until(colour, bg, toward, target=4.6):
    t = 0.0
    while ratio(colour, bg) < target and t < 1:
        t += 0.02; colour = mix(colour, toward, 0.02 / (1 - t + 0.02))
    return colour

def tokens(blue, green, t, dark):
    if not dark:
        bg = mix(NEUTRAL_L, green, TINT_L[t])
        fg = mix(blue, "#000000", 0.45)
        display = until(blue, bg, "#000000", 7)
        accent = until(green, bg, "#000000")
        if lum(green) > 0.15:
            up, down = blue, green
        else:
            up, down = green, mix(NEUTRAL_L, green, 0.10)
    else:
        bg = mix(NEUTRAL_D, blue, TINT_D[t])
        fg = mix("#eef1f3", green, 0.06)
        light_green = green if lum(green) > 0.15 else mix(green, "#34c98f", 0.55)
        display = until(light_green, bg, "#ffffff", 7)
        accent = until(light_green, bg, "#ffffff")
        up, down = light_green, mix(blue, "#000000", 0.25) if t >= 2 else blue
    muted = until(mix(fg, bg, 0.42), bg, fg)
    return dict(zip(TOKENS, [bg, fg, muted, mix(fg, bg, 0.82), accent, mix(fg, bg, 0.90), display, up, down]))

def decl(tk, dark):
    return "; ".join(f"--{k}: {v}" for k, v in tk.items()) + ("; color-scheme: dark" if dark else "; color-scheme: light")

light, dark = tokens(BLUE, GREEN, LIGHT_TINT, False), tokens(BLUE, GREEN, DARK_TINT, True)
css = [f':root {{ {decl(light, False)} }}',
       f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {decl(dark, True)} }} }}',
       f':root[data-theme="dark"] {{ {decl(dark, True)} }}']
pathlib.Path(sys.argv[1]).write_text("\n".join(css) + "\n")

bad = 0
for mode, tk in (("light", light), ("dark", dark)):
    r = {k: ratio(tk[k], tk["bg"]) for k in ("fg", "muted", "accent", "display")}
    print(mode, "  ".join(f"{k} {v:.1f}" for k, v in r.items()), f" lattice {ratio(tk['spin-up'], tk['spin-down']):.1f}")
    bad += sum(v < 4.5 for v in r.values())
if bad:
    sys.exit(f"{bad} contrast ratios below 4.5")
