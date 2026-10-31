"""Checks of the Tizen package files and of scripts/build-tizen.sh that need no Tizen CLI.

    python3 -m unittest discover -s tv/tizen
"""
import os
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCRIPT = ROOT / "scripts" / "build-tizen.sh"
W = "{http://www.w3.org/ns/widgets}"
T = "{http://tizen.org/ns/widgets}"


def config():
    return ET.parse(HERE / "config.xml").getroot()


class ConfigXml(unittest.TestCase):
    def test_is_a_widget_with_the_two_namespaces(self):
        self.assertEqual(config().tag, W + "widget")

    def test_application_id_is_package_dot_name_with_a_ten_character_package(self):
        app = config().find(T + "application")
        package = app.get("package")
        self.assertRegex(package, r"^[A-Za-z0-9]{10}$")
        self.assertEqual(app.get("id"), package + ".Kantahe")
        self.assertRegex(app.get("required_version"), r"^\d+\.\d+$")

    def test_widget_id_and_version(self):
        w = config()
        self.assertTrue(w.get("id").startswith("http"))
        self.assertRegex(w.get("version"), r"^\d{1,3}\.\d{1,3}\.\d{1,5}$")

    def test_tv_profile_and_start_page(self):
        w = config()
        self.assertEqual(w.find(T + "profile").get("name"), "tv")
        self.assertEqual(w.find(W + "content").get("src"), "index.html")
        self.assertEqual(w.find(W + "name").text, "Kantahe")

    def test_privileges_are_internet_and_remote_keys_only(self):
        names = {p.get("name") for p in config().findall(T + "privilege")}
        self.assertEqual(names, {"http://tizen.org/privilege/internet", "http://tizen.org/privilege/tv.inputdevice"})

    def test_settings(self):
        s = config().find(T + "setting")
        self.assertEqual(s.get("screen-orientation"), "landscape")
        self.assertEqual(s.get("context-menu"), "disable")
        self.assertEqual(s.get("background-support"), "disable")

    def test_any_server_may_be_reached(self):
        a = config().find(W + "access")
        self.assertEqual((a.get("origin"), a.get("subdomains")), ("*", "true"))

    def test_icon_is_the_brand_icon_512(self):
        icon = HERE / config().find(W + "icon").get("src")
        data = icon.read_bytes()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(int.from_bytes(data[16:20], "big"), 512)
        self.assertEqual(int.from_bytes(data[20:24], "big"), 512)
        self.assertEqual(data, (ROOT / "branding" / "export" / "icon-512.png").read_bytes(), "run: cp branding/export/icon-512.png tv/tizen/icon.png")


class Secrets(unittest.TestCase):
    def test_certificate_files_cannot_be_added_by_accident(self):
        for name in ("author.p12", "distributor.p12", "author.pwd", "profiles.xml"):
            r = subprocess.run(["git", "check-ignore", "-q", f"tv/tizen/{name}"], cwd=ROOT)
            self.assertEqual(r.returncode, 0, f"{name} is not ignored")


def run_script(*args, path=None):
    env = dict(os.environ)
    env["PATH"] = path if path is not None else "/usr/bin:/bin"  # no tizen here
    return subprocess.run(["bash", str(SCRIPT), *args], capture_output=True, text=True, env=env, cwd=ROOT)


class BuildScript(unittest.TestCase):
    def test_without_the_tizen_cli_it_says_so_and_fails_before_building(self):
        r = run_script("someprofile")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("tizen", r.stderr.lower())
        self.assertIn("Tizen Studio", r.stderr)
        self.assertNotIn("building", r.stdout.lower(), "it must check the CLI first")

    def test_without_a_profile_it_prints_the_usage(self):
        r = run_script()
        self.assertEqual(r.returncode, 2)
        self.assertIn("usage", r.stderr.lower())

    def test_unknown_option(self):
        r = run_script("--nope")
        self.assertEqual(r.returncode, 2)

    def test_stage_only_assembles_the_package_folder_without_the_cli(self):
        with tempfile.TemporaryDirectory() as out:
            env = dict(os.environ, KANTAHE_BUILD_DIR=out)
            r = subprocess.run(["bash", str(SCRIPT), "--stage-only"], capture_output=True, text=True, env=env, cwd=ROOT)
            self.assertEqual(r.returncode, 0, r.stderr)
            stage = Path(out) / "tizen"
            for name in ("index.html", "config.xml", "icon.png"):
                self.assertTrue((stage / name).is_file(), name)
            self.assertEqual((stage / "config.xml").read_bytes(), (HERE / "config.xml").read_bytes())
            self.assertIn('<base href="./index.html"', (stage / "index.html").read_text())
            self.assertTrue(list(stage.glob("main-*.js")) or list(stage.glob("chunk-*.js")))
            self.assertFalse(list(stage.glob("*.wgt")))
            self.assertFalse(list(stage.rglob("*.map")), "no source maps in a package")


if __name__ == "__main__":
    unittest.main()
