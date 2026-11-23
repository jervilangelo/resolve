"""Builds every Resolve brand asset from geometry.py. Run: python assets/branding/source/build.py"""
import io, json, os, struct, sys
from pathlib import Path

import cairosvg
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from geometry import FULL, SMALL, symbol, svg  # noqa: E402

SRC = Path(__file__).parent
OUT = SRC.parent
C = dict(forest="#1F4A36", forest_deep="#163627", forest_soft="#27583F", charcoal="#1E2321",
         night="#121614", ivory="#F6F2E8", parchment="#E9E2D2", sage="#8FA894", sage_light="#B5CBB9",
         brass="#A88A5C")
FONTS = {
    "bask": os.environ.get("RESOLVE_SERIF", "C:/Users/Jervil/AppData/Local/Wondershare/Wondershare Filmora/14.0.11.9772/Fonts/LibreBaskerville-Regular.ttf"),
    "plex500": os.environ.get("RESOLVE_SANS_500", "C:/Users/Jervil/Schedrift/node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff"),
    "plex400": os.environ.get("RESOLVE_SANS_400", "C:/Users/Jervil/Schedrift/node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff"),
}
CACHE = SRC / "outlines.json"
_cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
TAGLINE = "TAKE EVERY THOUGHT CAPTIVE."
DESCRIPTOR = "Privacy-first browser protection and voluntary accountability."


def text(font, s, tracking=0.0, kern=None):
    """Outline at 1000 units/em-normalised size. Returns d (baseline y=0), advance, cap height."""
    key = f"{font}|{s}|{tracking}|{json.dumps(kern or {})}"
    if key not in _cache:
        from fontTools.ttLib import TTFont
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        f = TTFont(FONTS[font])
        gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
        k = 1000 / f["head"].unitsPerEm
        x, parts = 0.0, []
        for i, ch in enumerate(s):
            g = cmap[ord(ch)]
            pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
            gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
            parts.append(pen.getCommands())
            x += hmtx[g][0] * k + tracking * 1000 + (kern or {}).get(str(i), 0)
        _cache[key] = dict(d=" ".join(parts), w=x - tracking * 1000, cap=f["OS/2"].sCapHeight * k)
    return _cache[key]


def place(t, color, x, baseline, cap):
    s = cap / t["cap"]
    return f'<path transform="translate({x:.2f} {baseline:.2f}) scale({s:.5f})" fill="{color}" d="{t["d"]}"/>', t["w"] * s


WORD = lambda: text("bask", "Resolve", 0.012, {"0": -18})
TAG = lambda: text("plex500", TAGLINE, 0.16)

# Mark extents inside the 256 canvas (full cut): x 28..228, y 36..220
MX0, MX1, MY0, MY1 = 28, 228, 36, 220


def mark(p, c1, c2, x, y, size, uid):
    return symbol(c1, c2, p=p, uid=uid, tx=x, ty=y, s=size / 256)


def horizontal(c_mark, c_word, small=False, tagline=None, uid="h"):
    p = SMALL if small else FULL
    body = mark(p, c_mark, c_mark, 0, 0, 256, uid)
    x = MX1 + 50
    if tagline:
        w, ww = place(WORD(), c_word, x, 150, 88)
        t, tw = place(TAG(), tagline, x + 3, 196, 19)
        body += w + t
        right = x + max(ww, tw + 3)
    else:
        w, ww = place(WORD(), c_word, x, 174, 92)
        body += w
        right = x + ww
    return svg(body, right - MX0, MY1 - MY0, "Resolve").replace(
        f'viewBox="0 0 {right - MX0:g} {MY1 - MY0:g}"', f'viewBox="{MX0} {MY0} {right - MX0:.1f} {MY1 - MY0}"')


def stacked(c_mark, c_word, uid="s"):
    cap = 62
    t = WORD()
    ww = t["w"] * cap / t["cap"]
    W = max(ww, MX1 - MX0) + 0
    ox = (W - (MX1 - MX0)) / 2 - MX0
    body = mark(FULL, c_mark, c_mark, ox, -MY0, 256, uid)
    w, _ = place(t, c_word, (W - ww) / 2, (MY1 - MY0) + 40 + cap, cap)
    return svg(body + w, W, (MY1 - MY0) + 40 + cap, "Resolve")


def tile(p=FULL, size=256, bg=None, fg=None, rx=0.2237, scale=0.74, uid="t"):
    bg, fg = bg or C["forest"], fg or C["ivory"]
    k = size / 256
    rect = f'<rect width="{size}" height="{size}" rx="{rx * size:.2f}" fill="{bg}"/>' if rx is not None else ""
    off = 128 * (1 - scale) * k
    return svg(rect + mark(p, fg, fg, off, off - 1.5 * k * scale, 256 * scale * k, uid), size, size)


def png(svg_text, path, w, h=None):
    path = OUT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=svg_text.encode(), write_to=str(path), output_width=w, output_height=h or w)


def write(path, text_):
    path = OUT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text_, encoding="utf-8")


def ico(path, svgs_by_size):
    imgs = []
    for size, s in svgs_by_size:
        b = io.BytesIO(cairosvg.svg2png(bytestring=s.encode(), output_width=size, output_height=size))
        imgs.append((size, b.getvalue()))
    head = struct.pack("<HHH", 0, 1, len(imgs))
    off, dirs, data = 6 + 16 * len(imgs), b"", b""
    for size, d in imgs:
        dirs += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(d), off + len(data))
        data += d
    (OUT / path).write_bytes(head + dirs + data)


def canvas(w, h, bg, inner):
    return svg(f'<rect width="{w}" height="{h}" fill="{bg}"/>{inner}', w, h, "Resolve")


def embed(svg_text, x, y, height):
    """Nest a lockup SVG at a given height."""
    vb = svg_text.split('viewBox="')[1].split('"')[0].split()
    vx, vy, vw, vh = map(float, vb)
    s = height / vh
    inner = svg_text.split("</title>", 1)[1].rsplit("</svg>", 1)[0]
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.5f}) translate({-vx} {-vy})">{inner}</g>', vw * s


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main():
    F, I, SL, CH, N = C["forest"], C["ivory"], C["sage_light"], C["charcoal"], C["night"]
    # Logo masters
    logos = {
        "symbol.svg": svg(symbol(F, uid="a")),
        "symbol-dark.svg": svg(symbol(SL, uid="a")),
        "symbol-black.svg": svg(symbol("#000000", uid="a")),
        "symbol-white.svg": svg(symbol("#FFFFFF", uid="a")),
        "symbol-small.svg": svg(symbol(F, p=SMALL, uid="a")),
        "horizontal-light.svg": horizontal(F, CH),
        "horizontal-dark.svg": horizontal(SL, I),
        "horizontal-black.svg": horizontal("#000000", "#000000"),
        "horizontal-white.svg": horizontal("#FFFFFF", "#FFFFFF"),
        "horizontal-compact-light.svg": horizontal(F, CH, small=True),
        "horizontal-compact-dark.svg": horizontal(SL, I, small=True),
        "stacked-light.svg": stacked(F, CH),
        "stacked-dark.svg": stacked(SL, I),
        "tagline-light.svg": horizontal(F, CH, tagline=C["forest"]),
        "tagline-dark.svg": horizontal(SL, I, tagline=SL),
    }
    for name, s in logos.items():
        write(f"logo/{name}", s)
        vb = list(map(float, s.split('viewBox="')[1].split('"')[0].split()))
        h = 1024 if name.startswith("symbol") else 512
        png(s, f"logo/png/{name[:-4]}.png", round(vb[2] / vb[3] * h), h)

    # App tiles
    full_tile, small_tile = tile(), tile(SMALL, rx=0.1875, scale=0.84)
    write("icon/app-icon.svg", full_tile)
    write("icon/app-icon-small.svg", small_tile)

    # Browser extension (Chrome/Brave/Edge/Firefox share these PNGs)
    for s in (16, 32):
        png(small_tile, f"extension/icon-{s}.png", s)
    png(full_tile, "extension/icon-48.png", 48)
    png(svg(f'<g transform="translate(16 16) scale(0.375)">{full_tile.split("</title>",1)[1].rsplit("</svg>",1)[0]}</g>', 128, 128), "extension/icon-128.png", 128)

    # Web app
    write("web/favicon.svg", small_tile)
    ico("web/favicon.ico", [(16, small_tile), (32, small_tile), (48, full_tile)])
    png(full_tile, "web/icon-192.png", 192)
    png(full_tile, "web/icon-512.png", 512)
    png(tile(rx=None, scale=0.6, uid="m").replace("<g", f'<rect width="256" height="256" fill="{F}"/><g', 1), "web/icon-maskable-512.png", 512)
    png(tile(rx=None, scale=0.68, uid="p").replace("<g", f'<rect width="256" height="256" fill="{F}"/><g', 1), "web/apple-touch-icon.png", 180)
    write("web/site.webmanifest", json.dumps({
        "name": "Resolve", "short_name": "Resolve", "theme_color": F, "background_color": I, "display": "standalone",
        "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, indent=2) + "\n")

    # Marketing / social / store
    desc = text("plex400", DESCRIPTOR, 0.0)
    tag_dark = horizontal(SL, I, tagline=SL)

    def hero(w, h, lock_h, with_desc=True, ghost=False):
        inner = ""
        if ghost:
            inner += mark(FULL, C["forest_soft"], C["forest_soft"], w - h * 0.95, -h * 0.05, h * 1.1, "g")
        lk, lw = embed(tag_dark, 0, 0, lock_h)
        dcap = lock_h * 0.105
        dw = desc["w"] * dcap / desc["cap"]
        total = lock_h + (lock_h * 0.42 if with_desc else 0)
        x = (w - lw) / 2 if not ghost else w * 0.085
        y = (h - total) / 2
        inner += lk.replace("translate(0.00 0.00)", f"translate({x:.2f} {y:.2f})", 1)
        if with_desc:
            dx = (w - dw) / 2 if not ghost else x
            inner += place(desc, SL, dx, y + total, dcap)[0]
        return canvas(w, h, F, inner)

    for name, (w, h, lh, d, gh) in {
        "social/github-social-preview": (1280, 640, 190, True, False),
        "social/og-image": (1200, 630, 180, True, False),
        "social/cover-1500x500": (1500, 500, 180, False, False),
        "store/promo-marquee-1400x560": (1400, 560, 170, True, True),
    }.items():
        s = hero(w, h, lh, d, gh)
        write(f"{name}.svg", s)
        png(s, f"{name}.png", w, h)
    st, sw = embed(stacked(SL, I), 0, 0, 150)
    s = canvas(440, 280, F, st.replace("translate(0.00 0.00)", f"translate({(440 - sw) / 2:.2f} 65)", 1))
    write("store/promo-small-440x280.svg", s)
    png(s, "store/promo-small-440x280.png", 440, 280)
    png(tile(rx=None, scale=0.6, uid="q").replace("<g", f'<rect width="256" height="256" fill="{F}"/><g', 1), "social/profile-400.png", 400)

    # Email header (600x96 CSS px, exported @2x)
    lk, lw = embed(horizontal(F, CH), 0, 0, 72)
    s = canvas(1200, 192, I, lk.replace("translate(0.00 0.00)", f"translate({(1200 - lw) / 2:.2f} 60)", 1)
               + f'<rect y="190" width="1200" height="2" fill="{C["parchment"]}"/>')
    write("email/email-header.svg", s)
    png(s, "email/email-header.png", 1200, 192)

    # Loader: the wedge presses down, then rests (respects reduced motion)
    ld = svg(symbol(F, uid="l"), 256, 256, "Loading").replace(
        '<path d="M56', '<path class="w" d="M56').replace(
        "<title>Loading</title>",
        "<title>Loading</title><style>.w{animation:p 1.4s cubic-bezier(.6,0,.3,1) infinite;transform-box:fill-box}"
        "@keyframes p{0%,100%{transform:translateY(-14px)}45%,60%{transform:translateY(0)}}"
        "@media (prefers-reduced-motion:reduce){.w{animation:none}}</style>")
    write("ui/loader.svg", ld)

    CACHE.write_text(json.dumps(_cache, separators=(",", ":")))
    for a, b, label in [(F, I, "forest/ivory"), (CH, I, "charcoal/ivory"), (I, F, "ivory/forest"),
                        (SL, N, "sage-light/night"), (I, N, "ivory/night"), (SL, F, "sage-light/forest"),
                        (C["sage"], I, "sage/ivory"), (C["brass"], I, "brass/ivory")]:
        print(f"{label:20s} {contrast(a, b):5.2f}:1")


if __name__ == "__main__":
    main()
