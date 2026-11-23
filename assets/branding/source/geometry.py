"""Parametric geometry for the Resolve symbol (256 x 256 canvas)."""
import math

FULL = dict(T=36, xl=56, xr=200, A=196, Y=186, r=22, w=24, g=10, n=4)
SMALL = dict(T=36, xl=40, xr=216, A=204, Y=176, r=40, w=40, g=18, n=2)


def _offset_triangle(pts, g):
    lines = []
    for i in range(3):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % 3]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        nx, ny = dy / L, -dx / L  # outward for clockwise screen order
        lines.append(((x1 + nx * g, y1 + ny * g), (dx, dy)))
    out = []
    for i in range(3):
        (p, d), (q, e) = lines[i - 1], lines[i]
        den = d[0] * e[1] - d[1] * e[0]
        t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
        out.append((p[0] + t * d[0], p[1] + t * d[1]))
    return out


def symbol(fill="#1F4A36", serpent=None, p=FULL, uid="r", tx=0, ty=0, s=1.0):
    serpent = serpent or fill
    T, xl, xr, A, Y, r, w, g, n = (p[k] for k in "T xl xr A Y r w g n".split())
    tri = [(xl, T), (xr, T), (128, A)]
    off = _offset_triangle(tri, g)
    x0 = 128 - n * r
    d = f"M{x0} {Y}"
    for i in range(n):
        d += f" A{r} {r} 0 0 {1 if i % 2 == 0 else 0} {x0 + 2 * r * (i + 1)} {Y}"
    hole = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in reversed(off)) + "Z"
    tri_d = "M" + " L".join(f"{x:g} {y:g}" for x, y in tri) + "Z"
    tf = f' transform="translate({tx:g} {ty:g}) scale({s:g})"' if (tx or ty or s != 1) else ""
    return (
        f'<g{tf}><clipPath id="{uid}"><path d="M-64 -64H320V320H-64Z{hole}"/></clipPath>'
        f'<path clip-path="url(#{uid})" d="{d}" fill="none" stroke="{serpent}" stroke-width="{w}" stroke-linecap="round"/>'
        f'<path d="{tri_d}" fill="{fill}"/></g>'
    )


def svg(body, w=256, h=256, title="Resolve"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')
