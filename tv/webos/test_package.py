"""Checks of the webOS package files, of scripts/check-webos-appinfo.py and of scripts/build-webos.sh (no webOS CLI needed).

    python3 -m unittest discover -s tv/webos
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CHECK = ROOT / "scripts" / "check-webos-appinfo.py"
BUILD = ROOT / "scripts" / "build-webos.sh"


def check(appinfo: Path):
    return subprocess.run([sys.executable, "-I", str(CHECK), str(appinfo)], capture_output=True, text=True)


def copy_package(dst: Path) -> Path:
    for name in ("appinfo.json", "icon-80.png", "icon-130.png"):
        shutil.copy(HERE / name, dst / name)
    return dst / "appinfo.json"


def png_size(path: Path):
    d = path.read_bytes()
    assert d[:8] == b"\x89PNG\r\n\x1a\n"
    return int.from_bytes(d[16:20], "big"), int.from_bytes(d[20:24], "big")


class AppInfo(unittest.TestCase):
    def info(self):
        return json.loads((HERE / "appinfo.json").read_text())

    def test_fields(self):
        i = self.info()
        self.assertEqual(i["id"], "com.loabletech.kantahe")
        self.assertEqual(i["type"], "web")
        self.assertEqual(i["main"], "index.html")
        self.assertEqual(i["title"], "Kantahe")
        self.assertEqual(i["icon"], "icon-80.png")
        self.assertEqual(i["largeIcon"], "icon-130.png")
        self.assertEqual(i["resolution"], "1920x1080")
        self.assertIs(i["disableBackHistoryAPI"], False)
        self.assertRegex(i["version"], r"^\d+\.\d+\.\d+$")
        self.assertTrue(i["vendor"])

    def test_icons_are_the_brand_icon_at_80_and_130(self):
        self.assertEqual(png_size(HERE / "icon-80.png"), (80, 80))
        self.assertEqual(png_size(HERE / "icon-130.png"), (130, 130))
        for n in (80, 130):
            self.assertEqual((HERE / f"icon-{n}.png").read_bytes(), (ROOT / "branding" / "export" / f"icon-{n}.png").read_bytes(), f"run: python3 branding/build.py && cp branding/export/icon-{n}.png tv/webos/")

    def test_device_keys_cannot_be_added_by_accident(self):
        for name in ("ssh_key", "id_rsa", "device.pem", "device.key"):
            r = subprocess.run(["git", "check-ignore", "-q", f"tv/webos/{name}"], cwd=ROOT)
            self.assertEqual(r.returncode, 0, f"{name} is not ignored")


class Checker(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.path = copy_package(self.dir)

    def tearDown(self):
        self.tmp.cleanup()

    def edit(self, fn):
        i = json.loads(self.path.read_text())
        fn(i)
        self.path.write_text(json.dumps(i))

    def test_the_real_package_passes(self):
        r = check(HERE / "appinfo.json")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_each_required_key_is_needed(self):
        for key in ("id", "version", "vendor", "type", "main", "title", "icon", "largeIcon"):
            self.edit(lambda i, k=key: i.pop(k, None))
            r = check(self.path)
            self.assertNotEqual(r.returncode, 0, key)
            self.assertIn(key, r.stderr)
            copy_package(self.dir)

    def test_an_icon_file_must_exist(self):
        (self.dir / "icon-130.png").unlink()
        r = check(self.path)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("icon-130.png", r.stderr)

    def test_icons_must_have_the_sizes_80_and_130(self):
        shutil.copy(HERE / "icon-130.png", self.dir / "icon-80.png")
        r = check(self.path)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("80", r.stderr)
        copy_package(self.dir)
        shutil.copy(HERE / "icon-80.png", self.dir / "icon-130.png")
        r = check(self.path)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("130", r.stderr)

    def test_a_file_that_is_not_a_png_is_refused(self):
        (self.dir / "icon-80.png").write_text("nope")
        self.assertNotEqual(check(self.path).returncode, 0)

    def test_the_main_page_is_not_checked_here_but_the_type_must_be_web(self):
        self.edit(lambda i: i.update(type="native"))
        self.assertNotEqual(check(self.path).returncode, 0)

    def test_bad_values(self):
        for key, value in (("id", "Kantahe"), ("version", "one"), ("title", ""), ("vendor", "")):
            self.edit(lambda i, k=key, v=value: i.update({k: v}))
            self.assertNotEqual(check(self.path).returncode, 0, f"{key}={value!r}")
            copy_package(self.dir)

    def test_regression_rules_of_the_webos_reference(self):
        # LG's appinfo.json reference: no leading zeros in the version, ids of lower-case letters, digits, minus signs
        # and periods that do not begin with the reserved com.palm or com.lge, titles of at most 20 characters
        for key, value in (("version", "01.0.0"), ("version", "1.00.0"), ("id", "com.lge.kantahe"), ("id", "com.palm.kantahe"), ("id", "com.Loable.Kantahe"), ("id", "com.loable.kanta_he"), ("title", "K" * 21)):
            self.edit(lambda i, k=key, v=value: i.update({k: v}))
            self.assertNotEqual(check(self.path).returncode, 0, f"{key}={value!r} must be refused")
            copy_package(self.dir)

    def test_regression_valid_values_the_reference_allows(self):
        for key, value in (("id", "com.loable-tech.kantahe"), ("version", "10.20.0"), ("version", "0.0.1"), ("title", "K" * 20)):
            self.edit(lambda i, k=key, v=value: i.update({k: v}))
            self.assertEqual(check(self.path).returncode, 0, f"{key}={value!r} must be accepted")
            copy_package(self.dir)

    def test_broken_json_and_a_missing_file(self):
        self.path.write_text("{")
        self.assertNotEqual(check(self.path).returncode, 0)
        self.assertNotEqual(check(self.dir / "missing.json").returncode, 0)


class BuildScript(unittest.TestCase):
    def run_build(self, *args, **env):
        e = dict(os.environ, PATH="/usr/bin:/bin")  # no ares-package here
        e.update(env)
        return subprocess.run(["bash", str(BUILD), *args], capture_output=True, text=True, env=e, cwd=ROOT)

    def test_without_the_webos_cli_it_says_so_before_building(self):
        r = self.run_build()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ares-package", r.stderr)
        self.assertIn("webOS", r.stderr)
        self.assertNotIn("building", r.stdout.lower())

    def test_unknown_option(self):
        self.assertEqual(self.run_build("--nope").returncode, 2)

    def test_stage_only_assembles_the_package_folder_without_the_cli(self):
        with tempfile.TemporaryDirectory() as out:
            e = dict(os.environ, KANTAHE_BUILD_DIR=out)
            r = subprocess.run(["bash", str(BUILD), "--stage-only"], capture_output=True, text=True, env=e, cwd=ROOT)
            self.assertEqual(r.returncode, 0, r.stderr)
            stage = Path(out) / "webos"
            for name in ("index.html", "appinfo.json", "icon-80.png", "icon-130.png"):
                self.assertTrue((stage / name).is_file(), name)
            self.assertEqual((stage / "appinfo.json").read_bytes(), (HERE / "appinfo.json").read_bytes())
            self.assertIn('<base href="./index.html"', (stage / "index.html").read_text())
            self.assertEqual(check(stage / "appinfo.json").returncode, 0, "the staged folder passes the check")
            self.assertFalse(list(stage.glob("*.ipk")))

    def fake_cli(self, bin_dir, name, body):
        f = Path(bin_dir) / name
        f.write_text("#!/bin/sh\n" + body + "\n")
        f.chmod(0o755)

    def test_with_the_cli_it_packages_the_staged_folder_into_the_dist_folder(self):
        with tempfile.TemporaryDirectory() as bin_dir, tempfile.TemporaryDirectory() as out:
            self.fake_cli(bin_dir, "ares-package", 'echo PACKAGED "$@"; touch "$3/com.loabletech.kantahe_1.0.0_all.ipk"')
            e = dict(os.environ, PATH=f"{bin_dir}:" + os.environ["PATH"], KANTAHE_BUILD_DIR=out, KANTAHE_DIST_DIR=out + "/dist")
            r = subprocess.run(["bash", str(BUILD)], capture_output=True, text=True, env=e, cwd=ROOT)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(f"PACKAGED {out}/webos -o {out}/dist", r.stdout)

    def test_a_failing_appinfo_check_stops_the_build_before_packaging(self):
        with tempfile.TemporaryDirectory() as bin_dir, tempfile.TemporaryDirectory() as out:
            self.fake_cli(bin_dir, "ares-package", "echo PACKAGED")
            # the check is run with python3: this one fails
            self.fake_cli(bin_dir, "python3", "exit 7")
            e = dict(os.environ, PATH=f"{bin_dir}:" + os.environ["PATH"], KANTAHE_BUILD_DIR=out, KANTAHE_DIST_DIR=out + "/dist")
            r = subprocess.run(["bash", str(BUILD)], capture_output=True, text=True, env=e, cwd=ROOT)
            self.assertNotEqual(r.returncode, 0)
            self.assertNotIn("PACKAGED", r.stdout)


if __name__ == "__main__":
    unittest.main()
