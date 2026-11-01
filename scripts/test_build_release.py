"""Checks of the SoundFont download of scripts/build-release.sh: it survives a network error and still verifies the
checksum. A local server answers 503 a given number of times, then the file; the real curl is used. The step after the
download (npm) is a stub that stops the run, so only the download is exercised.

    python3 -m unittest discover -s scripts -p 'test_build_release.py'
"""
import hashlib
import os
import shutil
import stat
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = b"RIFF....sfbk pretend SoundFont bytes" * 50
SHA = hashlib.sha256(DATA).hexdigest()


class Server:
    def __init__(self, fail_first):
        outer = self
        self.hits = 0
        self.fail_first = fail_first

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                outer.hits += 1
                if outer.hits <= outer.fail_first:
                    self.send_response(503)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Length", str(len(DATA)))
                self.end_headers()
                self.wfile.write(DATA)

            def log_message(self, *args):
                pass

        self.httpd = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/font.sf2"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def release_run(server, sha=SHA):
    """Runs build-release.sh in a temporary copy of the repository layout; returns (result, cache folder)."""
    root = Path(tempfile.mkdtemp(prefix="kantahe-test-release."))
    (root / "scripts").mkdir()
    shutil.copy(ROOT / "scripts" / "build-release.sh", root / "scripts")
    (root / "scripts" / "soundfont.lock").write_text(f"URL={server.url}\nSHA256={sha}\n")
    (root / "server" / "internal" / "webui" / "dist").mkdir(parents=True)
    (root / "server" / "internal" / "webui" / "dist" / "index.html").write_text("Web app not built")
    (root / "server" / "internal" / "assets" / "soundfont").mkdir(parents=True)
    (root / "web").mkdir()
    stubs = root / "stubs"
    stubs.mkdir()
    npm = stubs / "npm"
    npm.write_text("#!/bin/sh\necho 'stub npm: stopping after the download' >&2\nexit 1\n")
    npm.chmod(npm.stat().st_mode | stat.S_IXUSR)
    cache = root / "cache"
    env = dict(os.environ, PATH=f"{stubs}:/usr/bin:/bin", XDG_CACHE_HOME=str(cache), BUILD_RELEASE_RETRY_DELAY="1")
    r = subprocess.run(["bash", str(root / "scripts" / "build-release.sh"), "v0.0.0-test"], cwd=root, capture_output=True, text=True, env=env, timeout=120)
    return r, cache / "kantahe-build", root


class SoundFontDownload(unittest.TestCase):
    def setUp(self):
        self.servers = []

    def tearDown(self):
        for s in self.servers:
            s.close()

    def server(self, fail_first):
        s = Server(fail_first)
        self.servers.append(s)
        return s

    def test_regression_a_network_error_is_retried_a_release_must_not_fail_on_one_blip(self):
        s = self.server(fail_first=2)
        r, cache, root = release_run(s)
        self.addCleanup(shutil.rmtree, root, True)
        self.assertEqual(s.hits, 3, "two refusals and then the file")
        self.assertIn("stub npm", r.stderr, "the run got past the download: " + r.stdout + r.stderr)
        self.assertEqual((cache / f"GeneralUser-GS-{SHA}.sf2").read_bytes(), DATA)

    def test_a_server_that_keeps_failing_fails_the_release(self):
        s = self.server(fail_first=100)
        r, cache, root = release_run(s)
        self.addCleanup(shutil.rmtree, root, True)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("stub npm", r.stderr)
        self.assertFalse(list(cache.glob("*.sf2")) if cache.exists() else [])

    def test_a_wrong_checksum_still_fails_and_keeps_nothing(self):
        s = self.server(fail_first=0)
        r, cache, root = release_run(s, sha="0" * 64)
        self.addCleanup(shutil.rmtree, root, True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("SoundFont checksum mismatch", r.stderr)
        self.assertEqual(list(cache.glob("*")), [], "the download is removed")


if __name__ == "__main__":
    unittest.main()
