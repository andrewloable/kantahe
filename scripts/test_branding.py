"""Tests of the branding wiring: the web manifest, scripts/sync-branding.sh and docs/store-listing.md.

    python3 -m unittest discover -s scripts -p 'test_branding.py'
"""
import json
import math
import re
import shutil
import subprocess
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
            ROOT / "app/assets/branding/splash.png": "icon-512.png",
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


class FlutterSplash(unittest.TestCase):
    def test_the_splash_is_configured_with_the_brand_colour_and_an_existing_image(self):
        y = (ROOT / "app" / "pubspec.yaml").read_text()
        self.assertRegex(y, r"flutter_native_splash:\s*\n(?:.*\n)*?\s+color:\s*\"?#0c1230")
        self.assertIn("image: assets/branding/splash.png", y)
        self.assertRegex(y, r"flutter_native_splash: \d+\.\d+\.\d+")  # pinned, not a range
        self.assertTrue((ROOT / "app/assets/branding/splash.png").is_file())


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
