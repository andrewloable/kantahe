"""Tests of scripts/licenses.py (the licence report). Run: python3 -m unittest discover -s scripts -p 'test_licenses.py'"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import licenses as L  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

MIT = """MIT License

Copyright (c) 2021 Some Author

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction"""
BSD3 = """Copyright (c) 2009 The Go Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:
Neither the name of Google Inc. nor the names of its contributors may be used to endorse or promote products"""
BSD2 = """Copyright (c) 2015, X. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:
1. Redistributions of source code must retain the above copyright notice
2. Redistributions in binary form must reproduce the above copyright notice"""
APACHE = """                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/"""
ISC = """ISC License

Copyright (c) 2004 Someone

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright
notice and this permission notice appear in all copies."""
ZEROBSD = """Zero-Clause BSD

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted."""
ZLIB = """This software is provided 'as-is', without any express or implied warranty. In no event will the authors be held liable
Permission is granted to anyone to use this software for any purpose, including commercial applications, and to alter it
2. Altered source versions must be plainly marked as such"""
MPL = "Mozilla Public License Version 2.0\n==================================="
UNLICENSE = "This is free and unencumbered software released into the public domain."
GPL = "GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007"


class Classify(unittest.TestCase):
    def test_known_licences(self):
        for text, want in ((MIT, "MIT"), (BSD3, "BSD-3-Clause"), (BSD2, "BSD-2-Clause"), (APACHE, "Apache-2.0"), (ISC, "ISC"), (ZEROBSD, "0BSD"),
                           (ZLIB, "Zlib"), (MPL, "MPL-2.0"), (UNLICENSE, "Unlicense"), (GPL, "GPL-3.0")):
            self.assertEqual(L.classify(text), want)

    def test_unknown_text(self):
        self.assertIsNone(L.classify("All rights reserved. Do not copy."))
        self.assertIsNone(L.classify(""))

    def test_the_first_copyright_line(self):
        self.assertEqual(L.copyright_line(MIT), "Copyright (c) 2021 Some Author")
        self.assertEqual(L.copyright_line("nothing here"), "")


class Entry(unittest.TestCase):
    def test_apache_text_has_no_copyright_holder_to_show(self):
        # the licence text itself says "copyright notice"; that is not a holder
        self.assertEqual(L.entry("go", "x", "v1", True, APACHE + "\nthe copyright notice that is included in the work")["copyright"], "")

    def test_a_declared_licence_beats_the_text_and_an_unreadable_one_is_unknown(self):
        self.assertEqual(L.entry("npm", "x", "1", True, MIT, "ISC")["license"], "ISC")
        self.assertEqual(L.entry("npm", "x", "1", True, "nothing")["license"], "UNKNOWN")


class Texts(unittest.TestCase):
    """Redistributing a binary needs the licence text and the copyright notice, not just the name of the licence."""

    def test_an_entry_keeps_the_full_licence_text(self):
        self.assertIn("Permission is hereby granted, free of charge", L.entry("go", "x", "v1", True, MIT)["text"])

    def test_regression_notices_carry_every_distinct_text_once_with_the_packages_that_use_it(self):
        a = L.entry("go", "example.com/a", "v1", True, MIT)
        b = L.entry("npm", "b", "2", False, MIT)
        c = L.entry("dart", "c", "3", False, BSD3)
        text = L.render_notices([a, b, c], [])
        self.assertEqual(text.count("Permission is hereby granted, free of charge"), 1)
        self.assertEqual(text.count("Neither the name of Google Inc."), 1)
        section = text[text.index("## Licence texts"):]
        i = section.index("Permission is hereby granted")
        head = section[:i]
        self.assertIn("example.com/a", head.split("Permission")[0].rsplit("###", 1)[-1])
        self.assertIn("Copyright (c) 2021 Some Author", section)

    def test_texts_that_differ_only_in_spacing_are_one_text(self):
        a = L.entry("go", "a", "v1", True, MIT)
        b = L.entry("go", "b", "v1", True, MIT.replace("\n\n", "\n \n"))
        self.assertEqual(L.render_notices([a, b], []).count("Permission is hereby granted"), 1)

    def test_a_package_without_a_licence_file_is_listed_with_its_declared_licence(self):
        e = L.entry("npm", "nofile", "1", True, "", "MIT")
        text = L.render_notices([e], [])
        self.assertIn("no licence file", text.lower())
        self.assertIn("nofile", text[text.index("## Licence texts"):])

    def test_regression_the_flutter_engine_aggregate_is_not_taken_for_one_licence(self):
        # sky_engine's LICENSE file is Flutter's aggregate of the engine's third-party licences (over a megabyte)
        flutter = L.entry("dart", "flutter", "0.0.0", True, BSD3)
        sky = L.entry("dart", "sky_engine", "0.0.0", False, "vulkan-validation-layers\n" + APACHE + "x" * 300_000)
        L.use_flutter_licence([flutter, sky])
        self.assertEqual(sky["license"], "BSD-3-Clause")
        self.assertEqual(sky["text"], flutter["text"])

    def test_a_package_without_a_licence_file_shows_its_author_and_repository(self):
        e = L.entry("npm", "nofile", "1", True, "", "MIT", author="Kazuhiko Arase", repo="https://example.com/r.git")
        section = L.render_notices([e], [])
        self.assertIn("Kazuhiko Arase", section)
        self.assertIn("https://example.com/r.git", section)

    def test_the_flutter_engine_note_is_there(self):
        self.assertTrue(any("flutter engine" in x["name"].lower() for x in L.EXTRAS))

    def test_the_docker_image_base_is_mentioned_and_not_judged_by_the_allow_list(self):
        self.assertTrue(any("distroless" in x["note"].lower() for x in L.EXTRAS))
        self.assertEqual(L.check([], L.ALLOWED, {}, L.render_notices([], L.EXTRAS)), [])


class Expressions(unittest.TestCase):
    allowed = {"MIT", "Apache-2.0", "BSD-3-Clause"}

    def test_single_and_alternatives(self):
        self.assertTrue(L.is_allowed("MIT", self.allowed))
        self.assertFalse(L.is_allowed("GPL-3.0", self.allowed))
        self.assertTrue(L.is_allowed("(MIT OR GPL-3.0)", self.allowed))
        self.assertTrue(L.is_allowed("GPL-3.0 OR Apache-2.0", self.allowed))

    def test_both_needed_for_and(self):
        self.assertFalse(L.is_allowed("MIT AND GPL-3.0", self.allowed))
        self.assertTrue(L.is_allowed("MIT AND Apache-2.0", self.allowed))

    def test_leftovers_after_an_expression_are_not_allowed(self):
        self.assertFalse(L.is_allowed("MIT GPL-3.0", self.allowed))
        self.assertFalse(L.is_allowed("MIT)", self.allowed))

    def test_unknown_is_never_allowed(self):
        self.assertFalse(L.is_allowed("UNKNOWN", self.allowed))
        self.assertFalse(L.is_allowed("", self.allowed))
        self.assertFalse(L.is_allowed("SEE LICENSE IN LICENSE.txt", self.allowed))

    def test_the_allow_list_has_what_the_issue_names(self):
        for name in ("MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "ISC", "Zlib", "MPL-2.0", "GeneralUser-GS"):
            self.assertIn(name, L.ALLOWED)


class Parsers(unittest.TestCase):
    def test_npm_license_field(self):
        self.assertEqual(L.npm_license({"license": "MIT"}), "MIT")
        self.assertEqual(L.npm_license({"license": {"type": "ISC"}}), "ISC")
        self.assertEqual(L.npm_license({"licenses": [{"type": "MIT"}, {"type": "Apache-2.0"}]}), "(MIT OR Apache-2.0)")
        self.assertIsNone(L.npm_license({}))

    def test_go_mod_direct_requires(self):
        mod = "module x\n\ngo 1.25\n\nrequire (\n\ta.example/one v1.0.0\n\tb.example/two v2.0.0 // indirect\n)\n\nrequire c.example/three v3.0.0\n"
        self.assertEqual(L.go_direct(mod), ["a.example/one", "c.example/three"])

    def test_pubspec_direct_dependencies(self):
        y = "name: x\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.0.0\n  archive: 4.5.2\ndev_dependencies:\n  test: ^1.0.0\nflutter:\n  uses-material-design: true\n"
        self.assertEqual(L.pubspec_direct(y), ["flutter", "http", "archive"])


class Rendering(unittest.TestCase):
    entries = [
        {"eco": "go", "name": "example.com/a", "version": "v1.0.0", "license": "MIT", "copyright": "Copyright (c) A", "direct": True},
        {"eco": "npm", "name": "@s/b", "version": "2.0.0", "license": "Apache-2.0", "copyright": "", "direct": False},
    ]

    def test_notices_list_every_package_with_its_licence(self):
        text = L.render_notices(self.entries, L.EXTRAS)
        for needle in ("example.com/a", "v1.0.0", "MIT", "Copyright (c) A", "@s/b", "Apache-2.0", "GeneralUser GS"):
            self.assertIn(needle, text)

    def test_the_check_reports_what_is_not_allowed_and_what_is_missing(self):
        bad = self.entries + [{"eco": "go", "name": "evil.example/c", "version": "v1", "license": "GPL-3.0", "copyright": "", "direct": True}]
        problems = L.check(bad, {"MIT", "Apache-2.0"}, direct_expected={"go": ["example.com/a", "missing.example/m"]}, notices=L.render_notices(bad, L.EXTRAS))
        joined = "\n".join(problems)
        self.assertIn("evil.example/c", joined)
        self.assertIn("missing.example/m", joined)

    def test_a_stale_notices_file_is_reported(self):
        problems = L.check(self.entries, L.ALLOWED, direct_expected={}, notices="old text")
        self.assertTrue(any("THIRD_PARTY_NOTICES.md" in p for p in problems))

    def test_a_clean_input_has_no_problems(self):
        self.assertEqual(L.check(self.entries, L.ALLOWED, direct_expected={"go": ["example.com/a"]}, notices=L.render_notices(self.entries, L.EXTRAS)), [])


class Script(unittest.TestCase):
    def test_the_real_report_passes_and_lists_every_direct_dependency(self):
        r = subprocess.run(["bash", str(ROOT / "scripts" / "licenses.sh")], capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for name in ("connectrpc.com/connect", "modernc.org/sqlite", "@angular/core", "spessasynth_lib", "fflate", "qrcode-generator", "webview_flutter", "archive"):
            self.assertIn(name, r.stdout)

    def test_an_allow_list_without_mit_fails(self):
        r = subprocess.run(["bash", str(ROOT / "scripts" / "licenses.sh")], capture_output=True, text=True, cwd=ROOT, env={**__import__("os").environ, "KANTAHE_LICENSE_ALLOW": "Apache-2.0,BSD-3-Clause,BSD-2-Clause,ISC,Zlib,MPL-2.0,GeneralUser-GS"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("MIT", r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
