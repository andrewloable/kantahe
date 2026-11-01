#!/usr/bin/env python3
"""Kantahe logo: writes every SVG variant from one set of shapes, then renders the exports.

    python3 branding/build.py

Needs Google Chrome (renders the SVGs; ImageMagick's own SVG renderer gets clip paths and
gradients wrong) and ImageMagick `magick` (resizing, favicon.ico). Outputs:

    branding/*.svg            sources: icon, icon-small (<= 48 px), maskable, icon-ios, mark, lockups, splash, splash-logo, tv-banner
    branding/export/          favicon.ico/.svg, PNG icons, apple-touch-icon, maskable icons, icon-ios-1024 (no alpha),
                              lockup PNGs, 1920x1080 splash, the splash logo on a transparent background (splash-logo.png, its 960 px
                              version for the native splash and the Android 12 variant splash-android12-1152.png) and 320x180 launcher banner for TV apps

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


def icon_ios():
    # iOS draws its own rounded corners and wants a full square without alpha: the icon artwork on its own background
    return svg(512, 512, f"""
<defs>{BG_DEFS}</defs>
<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>{mark()}""", "Kantahe")


def lockup_shapes(sung, rest):
    return f"""
<g transform="translate(20 20) scale(.3125)">
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>{mark()}
</g>
<g transform="translate(212 40) scale(.8)">{wordmark(sung, rest)}</g>"""


def lockup(sung, rest):
    return svg(936, 200, f"\n<defs>{BG_DEFS}</defs>{lockup_shapes(sung, rest)}", "Kantahe")


def tv_banner():
    # the Android TV launcher banner, 320x180: the lockup (which carries the name) on the dark splash colour
    return svg(320, 180, f"""
<defs>{BG_DEFS}</defs>
<rect width="320" height="180" fill="#0a0e22"/>
<rect width="320" height="180" fill="url(#glow)"/>
<g transform="translate(20 60) scale(.2991)">{lockup_shapes(SUNG, UNSUNG)}</g>""", "Kantahe")


def splash():
    return svg(1920, 1080, f"""
<defs>{BG_DEFS}</defs>
<rect width="1920" height="1080" fill="#0a0e22"/>
<rect width="1920" height="1080" fill="url(#glow)"/>
<g transform="translate(810 265) scale(.5859)">
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>{mark()}
</g>
<g transform="translate(521 655)">{wordmark(SUNG, UNSUNG)}</g>""", "Kantahe")


# The composition of splash(): the tile at (810, 265) is 300 px square, the wordmark at (521, 655) is 878 wide with strokes of 20, so
# the wordmark spans y 645..815 (its path is 0..150, a round cap reaches 10 beyond it).
SPLASH_LEFT, SPLASH_TOP, SPLASH_RIGHT, SPLASH_BOTTOM = 521, 265, 521 + 878, 655 + 150 + 10
SPLASH_MARGIN = round(0.05 * max(SPLASH_RIGHT - SPLASH_LEFT, SPLASH_BOTTOM - SPLASH_TOP))
SPLASH_LOGO_BOX = (SPLASH_LEFT - SPLASH_MARGIN, SPLASH_TOP - SPLASH_MARGIN,
                   SPLASH_RIGHT - SPLASH_LEFT + 2 * SPLASH_MARGIN, SPLASH_BOTTOM - SPLASH_TOP + 2 * SPLASH_MARGIN)
SPLASH_LOGO_PX = 1536  # width of splash-logo.png
# The native splash of Android before 12 shows a bitmap at its own size per density, and flutter_native_splash takes the image as its xxxhdpi
# (4x) version: 1536 px would be 384 dp, wider than a 360 dp phone. 960 px is 240 dp: 480 px on a 1920 px TV at density 320, the size of the web splash.
SPLASH_LOGO_NATIVE_PX = 960
ANDROID12_CANVAS, ANDROID12_TILE = 1152, 634  # the icon of an Android 12 splash sits in a circle: the tile is about 55% of the canvas


def splash_logo():
    """Exactly the tile and the wordmark of splash(), same transforms and colours, on a transparent background, cropped to the
    composition plus a 5% margin. The background and the glow are not part of it (they are CSS or the native splash's colour)."""
    x, y, w, h = SPLASH_LOGO_BOX
    logo_defs = BG_DEFS[:BG_DEFS.index("  <radialGradient")]  # the tile's gradient, taken from the same source as splash()
    body = f"""
<defs>{logo_defs}</defs>
<g transform="translate(810 265) scale(.5859)">
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>{mark()}
</g>
<g transform="translate(521 655)">{wordmark(SUNG, UNSUNG)}</g>"""
    return svg(w, h, body, "Kantahe").replace(f'viewBox="0 0 {w} {h}"', f'viewBox="{x} {y} {w} {h}"')


SOURCES = {
    "kantahe-icon.svg": icon(),
    "kantahe-icon-small.svg": icon(small=True),
    "kantahe-maskable.svg": maskable(),
    "kantahe-icon-ios.svg": icon_ios(),
    "kantahe-mark.svg": svg(512, 512, mark(), "Kantahe"),
    "kantahe-lockup-dark.svg": lockup(SUNG, UNSUNG),
    "kantahe-lockup-light.svg": lockup(LIGHT_SUNG, LIGHT_INK),
    "kantahe-splash.svg": splash(),
    "kantahe-splash-logo.svg": splash_logo(),
    "kantahe-tv-banner.svg": tv_banner(),
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
                         "kantahe-maskable.svg": (1024, 1024), "kantahe-icon-ios.svg": (1024, 1024), "kantahe-mark.svg": (1024, 1024)}.items():
        big[name] = OUT / f"_{name}.png"
        render(HERE / name, big[name], w, h)

    for size in (16, 32, 48):
        resize(big["kantahe-icon-small.svg"], OUT / f"icon-{size}.png", size)
    for size in (64, 80, 128, 130, 192, 256, 512, 1024):  # 80 and 130: the webOS app icons
        resize(big["kantahe-icon.svg"], OUT / f"icon-{size}.png", size)
    for size in (192, 512, 1024):  # 1024: the iOS app icon, which must be a full square without alpha
        resize(big["kantahe-maskable.svg"], OUT / f"maskable-{size}.png", size)
    subprocess.run(["magick", str(big["kantahe-icon-ios.svg"]), "-alpha", "off", "-strip", str(OUT / "icon-ios-1024.png")], check=True)  # no alpha channel
    resize(big["kantahe-maskable.svg"], OUT / "apple-touch-icon.png", 180)  # iOS masks it itself
    resize(big["kantahe-mark.svg"], OUT / "mark-512.png", 512)
    subprocess.run(["magick", *(str(OUT / f"icon-{s}.png") for s in (16, 32, 48)),
                    str(OUT / "favicon.ico")], check=True)
    (OUT / "favicon.svg").write_text(SOURCES["kantahe-icon-small.svg"])

    render(HERE / "kantahe-lockup-dark.svg", OUT / "lockup-dark.png", 1872, 400)
    render(HERE / "kantahe-lockup-light.svg", OUT / "lockup-light.png", 1872, 400)
    render(HERE / "kantahe-splash.svg", OUT / "splash-1920x1080.png", 1920, 1080)
    logo_w = SPLASH_LOGO_BOX[2]
    render(HERE / "kantahe-splash-logo.svg", OUT / "splash-logo.png", SPLASH_LOGO_PX, round(SPLASH_LOGO_PX * SPLASH_LOGO_BOX[3] / logo_w))
    render(HERE / "kantahe-splash-logo.svg", OUT / "splash-logo-960.png", SPLASH_LOGO_NATIVE_PX, round(SPLASH_LOGO_NATIVE_PX * SPLASH_LOGO_BOX[3] / logo_w))
    # the Android 12 splash shows the icon in a circle: the tile alone, centred on a transparent square, at about 55% of its width
    subprocess.run(["magick", str(big["kantahe-icon.svg"]), "-filter", "Lanczos", "-resize", f"{ANDROID12_TILE}x{ANDROID12_TILE}",
                    "-background", "none", "-gravity", "center", "-extent", f"{ANDROID12_CANVAS}x{ANDROID12_CANVAS}", "-strip",
                    str(OUT / "splash-android12-1152.png")], check=True)
    # headless Chrome will not make a window this small: render at 4x and scale down
    render(HERE / "kantahe-tv-banner.svg", OUT / "_banner.png", 1280, 720)
    subprocess.run(["magick", str(OUT / "_banner.png"), "-filter", "Lanczos", "-resize", "320x180", "-strip",
                    str(OUT / "tv-banner-320x180.png")], check=True)
    (OUT / "_banner.png").unlink()
    for p in big.values():
        p.unlink()


if __name__ == "__main__":
    main()
