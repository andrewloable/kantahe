"""Tests of the branding wiring: the web manifest, scripts/sync-branding.sh and docs/store-listing.md.

    python3 -m unittest discover -s scripts -p 'test_branding.py'
"""
import json
import math
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / "branding" / "export"
PUBLIC = ROOT / "web" / "public"


def png_size(path: Path):
    d = path.read_bytes()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", path
    return int.from_bytes(d[16:20], "big"), int.from_bytes(d[20:24], "big")


def palette():
    src = (ROOT / "branding" / "build.py").read_text()
    m = re.search(r'SUNG, UNSUNG, ACCENT, INK = ("#\w+"), ("#\w+"), ("#\w+"), ("#\w+")', src)
    return dict(zip(("sung", "unsung", "accent", "ink"), m.groups()))


def content_radius(path: Path, threshold: float = 0.55) -> float:
    """How far from the centre, as a fraction of the width, the farthest bright pixel of the artwork lies."""
    raw = subprocess.run(["magick", str(path), "-colorspace", "Gray", "-depth", "8", "gray:-"], capture_output=True, check=True).stdout
    n = math.isqrt(len(raw))
    far = 0.0
    cut = int(threshold * 255)
    for i, v in enumerate(raw):
        if v > cut:
            far = max(far, math.hypot(i % n - n / 2 + 0.5, i // n - n / 2 + 0.5) / n)
    return far


@unittest.skipUnless(shutil.which("magick"), "ImageMagick is needed to look at the pixels")
class SafeZone(unittest.TestCase):
    """A maskable icon is cropped by the launcher: its artwork must stay inside the circle of 80 percent of the width (web
    manifest), and an Android adaptive foreground inside 66/108 of it (the launcher guarantees only that much)."""

    def test_the_maskable_icons_keep_the_artwork_inside_the_safe_circle(self):
        for name in ("maskable-192.png", "maskable-512.png"):
            r = content_radius(PUBLIC / name)
            self.assertLessEqual(r, 0.40, f"{name}: artwork reaches {r:.3f} of the width from the centre")

    def test_the_android_adaptive_foreground_stays_inside_66_of_108(self):
        r = content_radius(ROOT / "app" / "assets" / "branding" / "icon-adaptive.png")
        self.assertLessEqual(r, 33 / 108, f"artwork reaches {r:.3f}, the adaptive icon guarantees {33 / 108:.3f}")

    def test_a_full_size_icon_would_fail_this_check(self):
        # the rounded icon fills most of its square: it is not safe as a maskable icon
        self.assertGreater(content_radius(EXPORT / "icon-512.png"), 0.40)


class Manifest(unittest.TestCase):
    def manifest(self):
        return json.loads((PUBLIC / "manifest.webmanifest").read_text())

    def test_names_and_colours_come_from_the_brand(self):
        m = self.manifest()
        self.assertEqual(m["name"], "Kantahe")
        self.assertEqual(m["short_name"], "Kantahe")
        self.assertEqual(m["display"], "standalone")
        self.assertEqual(m["start_url"], "./")
        ink = palette()["ink"].strip('"')
        self.assertEqual(m["theme_color"].lower(), ink)
        self.assertRegex(m["background_color"], r"^#[0-9a-fA-F]{6}$")

    def test_icons_include_a_maskable_pair_and_every_file_has_its_size(self):
        icons = self.manifest()["icons"]
        want = {("192x192", "any"), ("512x512", "any"), ("192x192", "maskable"), ("512x512", "maskable")}
        self.assertEqual({(i["sizes"], i["purpose"]) for i in icons}, want)
        for i in icons:
            w, h = (int(x) for x in i["sizes"].split("x"))
            self.assertEqual(png_size(PUBLIC / i["src"]), (w, h), i["src"])
            self.assertEqual(i["type"], "image/png")

    def test_the_page_links_the_manifest_and_uses_the_same_theme_colour(self):
        html = (ROOT / "web" / "src" / "index.html").read_text()
        self.assertIn('rel="manifest" href="manifest.webmanifest"', html)
        self.assertIn(f'name="theme-color" content="{palette()["ink"].strip(chr(34))}"', html)

    def test_the_built_app_has_the_manifest_with_its_maskable_icons(self):
        built = ROOT / "web" / "dist" / "web" / "browser"
        if not (built / "index.html").exists():
            self.skipTest("run npx ng build in web/ first")
        text = (built / "manifest.webmanifest").read_text()
        self.assertIn("maskable", text)
        for name in ("icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png", "favicon.ico"):
            self.assertTrue((built / name).is_file(), name)


class Sync(unittest.TestCase):
    def sync(self):
        return subprocess.run(["bash", str(ROOT / "scripts" / "sync-branding.sh")], capture_output=True, text=True, cwd=ROOT)

    def status(self):
        return subprocess.run(["git", "status", "--short"], capture_output=True, text=True, cwd=ROOT).stdout

    def test_it_is_idempotent(self):
        r = self.sync()
        self.assertEqual(r.returncode, 0, r.stderr)
        first = self.status()
        self.assertEqual(self.sync().returncode, 0)
        self.assertEqual(self.status(), first)

    def test_every_client_has_the_exported_files(self):
        self.assertEqual(self.sync().returncode, 0)
        pairs = {
            PUBLIC / "favicon.ico": "favicon.ico",
            PUBLIC / "favicon.svg": "favicon.svg",
            PUBLIC / "apple-touch-icon.png": "apple-touch-icon.png",
            PUBLIC / "icon-192.png": "icon-192.png",
            PUBLIC / "icon-512.png": "icon-512.png",
            PUBLIC / "maskable-192.png": "maskable-192.png",
            PUBLIC / "maskable-512.png": "maskable-512.png",
            ROOT / "app/assets/branding/icon.png": "icon-1024.png",
            ROOT / "app/assets/branding/icon-ios.png": "icon-ios-1024.png",
            ROOT / "app/assets/branding/icon-adaptive.png": "maskable-512.png",
            ROOT / "app/assets/branding/splash-logo.png": "splash-logo.png",
            ROOT / "app/assets/branding/splash-logo-native.png": "splash-logo-960.png",
            ROOT / "app/assets/branding/splash-android12.png": "splash-android12-1152.png",
            ROOT / "app/android/app/src/main/res/drawable-xhdpi/tv_banner.png": "tv-banner-320x180.png",
            ROOT / "tv/tizen/icon.png": "icon-512.png",
            ROOT / "tv/webos/icon-80.png": "icon-80.png",
            ROOT / "tv/webos/icon-130.png": "icon-130.png",
        }
        for dst, src in pairs.items():
            self.assertEqual(dst.read_bytes(), (EXPORT / src).read_bytes(), f"{dst.relative_to(ROOT)} is not {src}")

    def test_the_ios_icon_has_no_alpha_and_is_a_full_square(self):
        d = (EXPORT / "icon-ios-1024.png").read_bytes()
        self.assertEqual(png_size(EXPORT / "icon-ios-1024.png"), (1024, 1024))
        self.assertNotEqual(d[25], 6, "colour type 6 is RGBA")  # IHDR colour type: 2 = RGB

    def test_it_refuses_to_run_when_an_export_is_missing(self):
        r = subprocess.run(["bash", str(ROOT / "scripts" / "sync-branding.sh")], capture_output=True, text=True, cwd=ROOT, env={"PATH": "/usr/bin:/bin", "KANTAHE_EXPORT_DIR": "/nonexistent"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("build.py", r.stderr)


class SplashArtwork(unittest.TestCase):
    """branding/kantahe-splash-logo.svg is the tile and the wordmark of the official splash, cut out: same transforms, same colours, no
    background, cropped to the composition plus a 5% margin. The web app's splash and the Flutter splash are made from it."""

    def svg(self, name):
        return (ROOT / "branding" / name).read_text()

    def test_it_has_exactly_the_composition_of_the_official_splash(self):
        official, logo = self.svg("kantahe-splash.svg"), self.svg("kantahe-splash-logo.svg")
        tile = '<g transform="translate(810 265) scale(.5859)">'
        word = '<g transform="translate(521 655)">'
        self.assertIn(tile, official)
        self.assertIn(word, official)
        self.assertIn(tile, logo)
        self.assertIn(word, logo)
        # the shapes inside are the same text: from the tile's group to the end of the wordmark
        cut = lambda s: s[s.index(tile):s.rindex("</g>") + 4]
        self.assertEqual(" ".join(cut(official).split()), " ".join(cut(logo).split()))

    def test_it_is_transparent_and_cropped_to_the_composition_plus_five_percent(self):
        logo = self.svg("kantahe-splash-logo.svg")
        self.assertNotIn('fill="#0a0e22"', logo, "the background colour is not part of the logo")
        self.assertNotIn("glow", logo)
        self.assertNotRegex(logo, r'<rect width="1920"')
        x, y, w, h = (float(v) for v in re.search(r'viewBox="([^"]+)"', logo).group(1).split())
        left, top, right, bottom = 521, 265, 521 + 878, 655 + 150 + 10  # tile top, wordmark left, wordmark right, wordmark bottom with its caps
        margin = round(0.05 * max(right - left, bottom - top))
        self.assertEqual((x, y, w, h), (left - margin, top - margin, right - left + 2 * margin, bottom - top + 2 * margin))

    def test_the_wordmark_colours_are_the_brand_ones(self):
        logo = self.svg("kantahe-splash-logo.svg")
        p = palette()
        strokes = re.findall(r'<path stroke="(#[0-9a-f]{6})" d="', logo)
        self.assertEqual(strokes, [p["sung"].strip('"'), p["unsung"].strip('"')])

    @unittest.skipUnless(shutil.which("magick"), "ImageMagick is needed to look at the pixels")
    def test_the_exports_have_their_sizes_and_a_transparent_background(self):
        self.assertEqual(png_size(EXPORT / "splash-logo.png")[0], 1536)
        self.assertEqual(png_size(EXPORT / "splash-logo-960.png")[0], 960)  # 240 dp for the native splash: narrower than a phone
        self.assertEqual(png_size(EXPORT / "splash-android12-1152.png"), (1152, 1152))
        for name in ("splash-logo.png", "splash-logo-960.png", "splash-android12-1152.png"):
            self.assertEqual((EXPORT / name).read_bytes()[25], 6, f"{name} must have an alpha channel (colour type 6)")
            corner = subprocess.run(["magick", str(EXPORT / name), "-format", "%[fx:p{0,0}.a]", "info:"], capture_output=True, text=True).stdout
            self.assertEqual(float(corner), 0.0, f"{name}: the corner must be transparent")
        # the Android 12 splash keeps the tile at about 55% of the width, centred: inside the circular mask
        w, h, ox, oy = (int(v) for v in subprocess.run(["magick", str(EXPORT / "splash-android12-1152.png"), "-trim", "-format", "%w %h %X %Y", "info:"],
                                                       capture_output=True, text=True).stdout.replace("+", " ").split())
        self.assertAlmostEqual(w / 1152, 0.55, delta=0.02)
        self.assertEqual(w, h)
        self.assertAlmostEqual(ox + w / 2, 576, delta=2)
        self.assertAlmostEqual(oy + h / 2, 576, delta=2)


class SyncSplash(unittest.TestCase):
    """scripts/sync-branding.sh puts the logo into web/src/index.html, and --check says whether it is current."""

    def repo(self):
        d = Path(tempfile.mkdtemp(prefix="kantahe-test-branding."))
        self.addCleanup(shutil.rmtree, d, True)
        for rel in ("scripts/sync-branding.sh", "branding/kantahe-splash-logo.svg", "web/src/index.html"):
            (d / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / rel, d / rel)
        return d

    def run_sync(self, repo, *args):
        return subprocess.run(["bash", str(repo / "scripts" / "sync-branding.sh"), *args], capture_output=True, text=True,
                              env={"PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin", "KANTAHE_EXPORT_DIR": str(EXPORT)})

    def test_the_repository_is_current(self):
        r = subprocess.run(["bash", str(ROOT / "scripts" / "sync-branding.sh"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_check_fails_when_the_logo_in_the_page_is_not_the_current_one(self):
        d = self.repo()
        page = d / "web/src/index.html"
        page.write_text(page.read_text().replace('width="512" height="512" rx="112"', 'width="512" height="512" rx="111"', 1))
        r = self.run_sync(d, "--check")
        self.assertEqual(r.returncode, 1)
        self.assertIn("does not hold the current splash logo", r.stderr)

    def test_check_fails_when_the_logo_source_changes(self):
        d = self.repo()
        svg = d / "branding/kantahe-splash-logo.svg"
        svg.write_text(svg.read_text().replace("#ffd23f", "#ffd23e", 1))
        self.assertEqual(self.run_sync(d, "--check").returncode, 1)

    def test_check_changes_nothing(self):
        d = self.repo()
        page = d / "web/src/index.html"
        page.write_text(page.read_text().replace("rx=\"112\"", "rx=\"111\"", 1))
        before = page.read_text()
        self.run_sync(d, "--check")
        self.assertEqual(page.read_text(), before)

    def test_sync_repairs_the_page_and_is_idempotent(self):
        d = self.repo()
        page = d / "web/src/index.html"
        page.write_text(re.sub(r"(<!-- brand-splash:begin -->).*?(<!-- brand-splash:end -->)", r"\1\n\2", page.read_text(), flags=re.S))
        self.assertEqual(self.run_sync(d, "--check").returncode, 1)
        self.assertEqual(self.run_sync(d).returncode, 0)
        fixed = page.read_text()
        self.assertEqual(fixed, (ROOT / "web/src/index.html").read_text(), "the repaired page is the committed one")
        self.assertEqual(self.run_sync(d, "--check").returncode, 0)
        self.assertEqual(self.run_sync(d).returncode, 0)
        self.assertEqual(page.read_text(), fixed)

    def test_every_id_of_the_logo_is_prefixed(self):
        html = (ROOT / "web/src/index.html").read_text()
        block = re.search(r"<!-- brand-splash:begin -->(.*?)<!-- brand-splash:end -->", html, re.S).group(1)
        ids = re.findall(r'\bid="([^"]+)"', block)
        self.assertTrue(ids)
        self.assertTrue(all(i.startswith("splash-") for i in ids), ids)
        for ref in re.findall(r"url\(#([^)]+)\)", block):
            self.assertIn(ref, ids)

    def test_a_page_without_the_markers_is_refused(self):
        d = self.repo()
        page = d / "web/src/index.html"
        page.write_text(page.read_text().replace("brand-splash:begin", "x"))
        r = self.run_sync(d, "--check")
        self.assertEqual(r.returncode, 1)
        self.assertIn("no brand-splash markers", r.stderr)


class FlutterSplash(unittest.TestCase):
    def test_the_splash_is_configured_with_the_splash_background_and_the_official_logo(self):
        y = (ROOT / "app" / "pubspec.yaml").read_text()
        # #0a0e22 is the background of the official splash (branding/build.py splash()); the ink #0c1230 is only the colour of the logo's shapes
        self.assertRegex(y, r"flutter_native_splash:\s*\n(?:.*\n)*?\s+color:\s*\"?#0a0e22")
        self.assertNotRegex(y, r"flutter_native_splash:\s*\n(?:.*\n)*?\s+color:\s*\"?#0c1230")
        self.assertIn("image: assets/branding/splash-logo-native.png", y)
        self.assertIn("image: assets/branding/splash-android12.png", y)
        self.assertRegex(y, r"flutter_native_splash: \d+\.\d+\.\d+")  # pinned, not a range
        for name in ("splash-logo.png", "splash-logo-native.png", "splash-android12.png"):
            self.assertTrue((ROOT / "app/assets/branding" / name).is_file(), name)
        self.assertFalse((ROOT / "app/assets/branding/splash.png").exists(), "the old splash was the app icon, not the official logo")

    def test_the_sync_script_no_longer_makes_the_icon_the_splash(self):
        script = (ROOT / "scripts" / "sync-branding.sh").read_text()
        self.assertNotRegex(script, r"icon-512\.png app/assets/branding/splash")


class StoreListing(unittest.TestCase):
    text = None

    @classmethod
    def setUpClass(cls):
        cls.text = (ROOT / "docs" / "store-listing.md").read_text()

    def block(self, heading):
        m = re.search(rf"^## {re.escape(heading)}\n+```\n(.*?)\n```", self.text, re.S | re.M)
        self.assertIsNotNone(m, f"no '## {heading}' block")
        return m.group(1).strip()

    def test_limits_of_the_stores(self):
        self.assertLessEqual(len(self.block("Google Play: short description")), 80)
        self.assertLessEqual(len(self.block("Google Play: full description")), 4000)
        self.assertLessEqual(len(self.block("App Store: subtitle")), 30)
        self.assertLessEqual(len(self.block("App Store: keywords")), 100)
        self.assertLessEqual(len(self.block("App Store: description")), 4000)
        self.assertLessEqual(len(self.block("Name")), 30)

    def test_the_privacy_note_says_what_is_true(self):
        priv = self.text[self.text.index("## Privacy"):]
        for needle in ("self-hosted", "your own server", "microphone", "no analytics"):
            self.assertIn(needle, priv.lower() if needle.islower() else priv)

    def test_it_does_not_name_other_products(self):
        self.assertIsNone(re.search(r"jellyfin|\bplex\b|\bemby\b|navidrome|subsonic", self.text, re.I))

    def test_it_says_the_project_ships_no_songs(self):
        self.assertIn("no songs", self.text.lower())


if __name__ == "__main__":
    unittest.main()
