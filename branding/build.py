#!/usr/bin/env python3
"""Kantahe logo: writes every SVG variant from one set of shapes, then renders the exports.

    python3 branding/build.py

Needs Google Chrome (renders the SVGs; ImageMagick's own SVG renderer gets clip paths and
gradients wrong) and ImageMagick `magick` (resizing, favicon.ico). Outputs:

    branding/*.svg            sources: icon, icon-small (<= 48 px), maskable, mark, lockups, splash
    branding/export/          favicon.ico/.svg, PNG icons, apple-touch-icon, maskable icons,
                              lockup PNGs, 1920x1080 splash for TV apps

The design: a handheld singing mic whose ball grille is half "sung" (yellow) and half "unsung"
(white), the same colour wipe the player draws over lyrics, with two music notes. The wordmark colours "kanta" (Tagalog
for "song") as already sung and "he" as still to come.
"""
import pathlib
import subprocess
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "export"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# palette shared with the player UI
SUNG, UNSUNG, ACCENT, INK = "#ffd23f", "#ffffff", "#4fd1ff", "#0c1230"
LIGHT_SUNG, LIGHT_INK = "#c98a00", "#1d2550"  # wordmark on white backgrounds

BG_DEFS = """
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a3592"/><stop offset=".55" stop-color="#141a46"/>
    <stop offset="1" stop-color="#4a1c6e"/>
  </linearGradient>
  <radialGradient id="glow" cx=".5" cy=".42" r=".55">
    <stop offset="0" stop-color="#4fd1ff" stop-opacity=".22"/>
    <stop offset="1" stop-color="#4fd1ff" stop-opacity="0"/>
  </radialGradient>"""


def mark(small=False):
    """A handheld singing mic tilted 30 degrees, ball grille top right, two beamed notes top left.
    512 x 512 box, centred. The handle is drawn upright and rotated about (256, 300); the ball is
    drawn where the rotation puts it (331, 170) so the yellow/white wipe stays vertical on screen."""
    cx, cy, r = 331, 170, 88
    mesh = "" if small else f"""
      <path stroke="{INK}" stroke-opacity=".16" stroke-width="4" d="{''.join(
          f'M{cx - 120 + i * 28} {cy - 120}l240 240M{cx + 120 - i * 28} {cy - 120}l-240 240'
          for i in range(-5, 14))}"/>"""
    slot = "" if small else f"""
      <path d="M256 296V336" stroke="{INK}" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>"""
    return f"""
  <g transform="translate(-6 -15)">
    <clipPath id="ball"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>
    <g clip-path="url(#ball)">
      <rect x="{cx - r}" y="{cy - r}" width="{r + 6}" height="{2 * r}" fill="{SUNG}"/>
      <rect x="{cx + 6}" y="{cy - r}" width="{r}" height="{2 * r}" fill="{UNSUNG}"/>{mesh}
    </g>
    <g transform="rotate(30 256 300)">
      <path d="M206 262H306L284 452Q281 470 263 470H249Q231 470 228 452Z" fill="{UNSUNG}"/>
      <rect x="200" y="232" width="112" height="32" rx="12" fill="{ACCENT}"/>{slot}
    </g>
    <g fill="{ACCENT}">
      <ellipse cx="128" cy="236" rx="24" ry="17" transform="rotate(-20 128 236)"/>
      <ellipse cx="200" cy="214" rx="24" ry="17" transform="rotate(-20 200 214)"/>
      <path d="M140 232V124H{160 if small else 154}V232ZM212 210V102H{232 if small else 226}V210Z"/>
      <path d="M140 124L226 98V{126 if small else 122}L140 {152 if small else 148}Z"/>
    </g>
  </g>"""


def wordmark(sung, rest):
    """'kantahe' as round monoline strokes: x-height 50..150, ascender 0, 878 wide incl. caps."""
    return f"""
  <g fill="none" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="{sung}" d="M10 0V150M72 50L10 112M36 86L74 150
      M216 100A50 50 0 1 1 116 100A50 50 0 1 1 216 100M216 50V150
      M260 50V150M260 100A45 45 0 0 1 350 100V150
      M414 10V125A25 25 0 0 0 439 150M394 50H446
      M590 100A50 50 0 1 1 490 100A50 50 0 1 1 590 100M590 50V150"/>
    <path stroke="{rest}" d="M634 0V150M634 100A45 45 0 0 1 724 100V150
      M768 100H868A50 50 0 1 0 853.36 135.36"/>
  </g>"""


def svg(w, h, body, title):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}">
<title>{title}</title>{body}
</svg>
"""


def icon(small=False):
    return svg(512, 512, f"""
<defs>{BG_DEFS}</defs>
<rect width="512" height="512" rx="112" fill="url(#bg)"/>
<rect width="512" height="512" rx="112" fill="url(#glow)"/>{mark(small)}""", "Kantahe")


def maskable():
    # full bleed; the mark is scaled into the 80% safe circle of Android adaptive icons
    return svg(512, 512, f"""
<defs>{BG_DEFS}</defs>
<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>
<g transform="translate(256 256) scale(.74) translate(-256 -256)">{mark()}</g>""", "Kantahe")


def lockup(sung, rest):
    return svg(936, 200, f"""
<defs>{BG_DEFS}</defs>
<g transform="translate(20 20) scale(.3125)">
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>{mark()}
</g>
<g transform="translate(212 40) scale(.8)">{wordmark(sung, rest)}</g>""", "Kantahe")


def splash():
    return svg(1920, 1080, f"""
<defs>{BG_DEFS}</defs>
<rect width="1920" height="1080" fill="#0a0e22"/>
<rect width="1920" height="1080" fill="url(#glow)"/>
<g transform="translate(810 265) scale(.5859)">
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>{mark()}
</g>
<g transform="translate(521 655)">{wordmark(SUNG, UNSUNG)}</g>""", "Kantahe")


SOURCES = {
    "kantahe-icon.svg": icon(),
    "kantahe-icon-small.svg": icon(small=True),
    "kantahe-maskable.svg": maskable(),
    "kantahe-mark.svg": svg(512, 512, mark(), "Kantahe"),
    "kantahe-lockup-dark.svg": lockup(SUNG, UNSUNG),
    "kantahe-lockup-light.svg": lockup(LIGHT_SUNG, LIGHT_INK),
    "kantahe-splash.svg": splash(),
}


def render(src, png, w, h):
    """Chrome screenshot of the SVG at w x h CSS px, transparent where the SVG is."""
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                        f"--user-data-dir={profile}", "--force-device-scale-factor=1",
                        "--default-background-color=00000000", f"--window-size={w},{h}",
                        f"--screenshot={png}", src.as_uri()],
                       check=True, capture_output=True)


def resize(src, dst, size):
    subprocess.run(["magick", str(src), "-filter", "Lanczos", "-resize", f"{size}x{size}",
                    "-strip", str(dst)], check=True)


def main():
    OUT.mkdir(exist_ok=True)
    for name, text in SOURCES.items():
        (HERE / name).write_text(text)

    big = {}
    for name, (w, h) in {"kantahe-icon.svg": (1024, 1024), "kantahe-icon-small.svg": (512, 512),
                         "kantahe-maskable.svg": (1024, 1024), "kantahe-mark.svg": (1024, 1024)}.items():
        big[name] = OUT / f"_{name}.png"
        render(HERE / name, big[name], w, h)

    for size in (16, 32, 48):
        resize(big["kantahe-icon-small.svg"], OUT / f"icon-{size}.png", size)
    for size in (64, 128, 192, 256, 512, 1024):
        resize(big["kantahe-icon.svg"], OUT / f"icon-{size}.png", size)
    for size in (192, 512):
        resize(big["kantahe-maskable.svg"], OUT / f"maskable-{size}.png", size)
    resize(big["kantahe-maskable.svg"], OUT / "apple-touch-icon.png", 180)  # iOS masks it itself
    resize(big["kantahe-mark.svg"], OUT / "mark-512.png", 512)
    subprocess.run(["magick", *(str(OUT / f"icon-{s}.png") for s in (16, 32, 48)),
                    str(OUT / "favicon.ico")], check=True)
    (OUT / "favicon.svg").write_text(SOURCES["kantahe-icon-small.svg"])

    render(HERE / "kantahe-lockup-dark.svg", OUT / "lockup-dark.png", 1872, 400)
    render(HERE / "kantahe-lockup-light.svg", OUT / "lockup-light.png", 1872, 400)
    render(HERE / "kantahe-splash.svg", OUT / "splash-1920x1080.png", 1920, 1080)
    for p in big.values():
        p.unlink()


if __name__ == "__main__":
    main()
