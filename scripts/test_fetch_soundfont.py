"""Checks of scripts/fetch-soundfont.sh: it puts the pinned default SoundFont into the build tree, survives a network error, verifies the
checksum, and does nothing when the file is already there. A local server answers 503 a given number of times, then the file; the real
curl is used.

    python3 -m unittest discover -s scripts -p 'test_fetch_soundfont.py'
"""
import hashlib
import os
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = b"RIFF....sfbk pretend SoundFont bytes" * 50
SHA = hashlib.sha256(DATA).hexdigest()
NAME = "GeneralUser-GS.sf2"


class Server:
    def __init__(self, fail_first=0):
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


class FetchSoundFont(unittest.TestCase):
    def setUp(self):
        self.servers = []
        self.root = Path(tempfile.mkdtemp(prefix="kantahe-test-fetch."))
        self.addCleanup(shutil.rmtree, self.root, True)
        (self.root / "scripts").mkdir()
        shutil.copy(ROOT / "scripts" / "fetch-soundfont.sh", self.root / "scripts")
        self.dest = self.root / "server" / "internal" / "assets" / "soundfont"
        self.cache = self.root / "cache"

    def tearDown(self):
        for s in self.servers:
            s.close()

    def server(self, fail_first=0):
        s = Server(fail_first)
        self.servers.append(s)
        return s

    def run_script(self, server, sha=SHA, *args):
        (self.root / "scripts" / "soundfont.lock").write_text(f"URL={server.url}\nSHA256={sha}\n")
        env = dict(os.environ, XDG_CACHE_HOME=str(self.cache), BUILD_RELEASE_RETRY_DELAY="1")
        return subprocess.run(["bash", str(self.root / "scripts" / "fetch-soundfont.sh"), *args], cwd=self.root, capture_output=True, text=True, env=env, timeout=120)

    def test_regression_the_font_is_put_into_the_build_tree_with_the_right_bytes(self):
        s = self.server()
        r = self.run_script(s)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((self.dest / NAME).read_bytes(), DATA)

    def test_a_second_run_downloads_nothing(self):
        s = self.server()
        self.assertEqual(self.run_script(s).returncode, 0)
        self.assertEqual(s.hits, 1)
        shutil.rmtree(self.cache)  # not even the cache: the font in the build tree is enough
        r = self.run_script(s)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(s.hits, 1, "the font was there already")
        self.assertFalse(self.cache.exists(), "and nothing was fetched into the cache")

    def test_the_cache_serves_a_fresh_tree(self):
        s = self.server()
        self.assertEqual(self.run_script(s).returncode, 0)
        shutil.rmtree(self.dest)
        self.assertEqual(self.run_script(s).returncode, 0)
        self.assertEqual(s.hits, 1, "the second tree was filled from the cache")
        self.assertEqual((self.dest / NAME).read_bytes(), DATA)

    def test_a_network_error_is_retried(self):
        s = self.server(fail_first=2)
        r = self.run_script(s)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(s.hits, 3, "two refusals and then the file")
        self.assertEqual((self.dest / NAME).read_bytes(), DATA)

    def test_a_wrong_checksum_fails_and_keeps_nothing(self):
        s = self.server()
        r = self.run_script(s, sha="0" * 64)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("SoundFont checksum mismatch", r.stderr)
        self.assertFalse((self.dest / NAME).exists())
        self.assertEqual(list(self.cache.glob("*/*")) if self.cache.exists() else [], [], "the download is removed")

    def test_a_file_with_the_wrong_content_is_replaced(self):
        s = self.server()
        self.dest.mkdir(parents=True)
        (self.dest / NAME).write_bytes(b"old font")
        r = self.run_script(s)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((self.dest / NAME).read_bytes(), DATA)

    def test_a_destination_can_be_named(self):
        s = self.server()
        other = self.root / "elsewhere"
        r = self.run_script(s, SHA, str(other))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((other / NAME).read_bytes(), DATA)


if __name__ == "__main__":
    unittest.main()
