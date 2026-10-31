"""Tests of scripts/check-links.py. Run: python3 -m unittest discover -s scripts -p 'test_check_links.py'"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("check_links", HERE / "check-links.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def tree(files):
    d = tempfile.TemporaryDirectory()
    root = Path(d.name)
    for name, text in files.items():
        p = root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
    return d, root


class Links(unittest.TestCase):
    def problems(self, files, check):
        d, root = tree(files)
        with d:
            return C.check([root / c for c in check], root)

    def test_good_links_pass(self):
        files = {"README.md": "[guide](docs/a.md) and [section](docs/a.md#the-heading) and [dir](docs/) and ![i](pic.png)",
                 "docs/a.md": "# The heading\n\ntext [back](../README.md#top-title)\n", "pic.png": "x"}
        files["README.md"] = "# Top title\n\n" + files["README.md"]
        self.assertEqual(self.problems(files, ["README.md", "docs/a.md"]), [])

    def test_a_missing_file_is_reported_with_its_place(self):
        p = self.problems({"README.md": "line one\n[nope](docs/missing.md)\n"}, ["README.md"])
        self.assertEqual(len(p), 1)
        self.assertIn("README.md:2", p[0])
        self.assertIn("docs/missing.md", p[0])

    def test_a_missing_anchor_is_reported(self):
        p = self.problems({"README.md": "# A\n[x](docs/a.md#nothing)", "docs/a.md": "# Real\n"}, ["README.md"])
        self.assertEqual(len(p), 1)
        self.assertIn("#nothing", p[0])

    def test_anchors_follow_the_github_rules(self):
        files = {"README.md": "[a](#whats-this-1) [b](#2-behaviour-the-owners-rules)\n\n## What's this? (1)\n\n## 2. Behaviour (the owner's rules)\n"}
        self.assertEqual(self.problems(files, ["README.md"]), [])

    def test_repeated_headings_get_a_number(self):
        files = {"README.md": "[b](#same-1)\n\n# Same\n\n# Same\n"}
        self.assertEqual(self.problems(files, ["README.md"]), [])

    def test_links_in_code_are_not_links(self):
        files = {"README.md": "```sh\n[x](nope.md)\n```\nand `[y](nope2.md)` here"}
        self.assertEqual(self.problems(files, ["README.md"]), [])

    def test_external_links_are_not_fetched(self):
        files = {"README.md": "[x](https://example.invalid/page) <https://example.invalid/b> [m](mailto:a@b.c)"}
        self.assertEqual(self.problems(files, ["README.md"]), [])

    def test_a_missing_image_is_reported(self):
        self.assertEqual(len(self.problems({"README.md": "![i](missing.png)"}, ["README.md"])), 1)

    def test_a_link_with_a_title_and_an_angle_target(self):
        files = {"README.md": '[x](docs/a.md "Title") [y](<docs/a b.md>)', "docs/a.md": "x", "docs/a b.md": "y"}
        self.assertEqual(self.problems(files, ["README.md"]), [])

    def test_reference_style_links(self):
        self.assertEqual(len(self.problems({"README.md": "[x][r]\n\n[r]: docs/missing.md\n"}, ["README.md"])), 1)

    def test_a_link_outside_the_repository_is_reported(self):
        self.assertEqual(len(self.problems({"README.md": "[x](../../etc/passwd)"}, ["README.md"])), 1)


class Script(unittest.TestCase):
    def test_the_real_docs_have_no_broken_links(self):
        r = subprocess.run([sys.executable, str(HERE / "check-links.py")], capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_exit_code_one_when_a_link_is_broken(self):
        d, root = tree({"README.md": "[x](gone.md)"})
        with d:
            r = subprocess.run([sys.executable, str(HERE / "check-links.py"), "--root", str(root), "README.md"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 1)
            self.assertIn("gone.md", r.stderr)


if __name__ == "__main__":
    unittest.main()
