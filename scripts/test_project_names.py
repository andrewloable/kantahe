#!/usr/bin/env python3
"""The project's domain is kantahe.party, and its identifiers (Android applicationId, iOS bundle id, webOS app id, launchd label, channel
names) start with party.kantahe. No tracked text file may carry the old company names (loable.tech, tech.loable, loabletech): the
author's own name in LICENSE is not one of them."""
import os
import re
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = re.compile(r"loable\.tech|tech\.loable|loabletech|loable-tech", re.IGNORECASE)
SKIP_DIRS = (".beads/",)
SELF = "scripts/test_project_names.py"  # it has to spell the old names out


def tracked_files():
    # tracked files and new ones that are not ignored; a file that was moved or deleted and is not committed yet is not on disk
    out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT, check=True, capture_output=True).stdout
    return [p.decode() for p in out.split(b"\0") if p and os.path.exists(os.path.join(ROOT, p.decode()))]


class ProjectNames(unittest.TestCase):
    def test_no_tracked_file_has_an_old_company_name(self):
        found = []
        for rel in tracked_files():
            if rel.startswith(SKIP_DIRS) or rel == SELF:
                continue
            if OLD.search(rel):
                found.append(f"{rel}: the file name")
            path = os.path.join(ROOT, rel)
            if not os.path.isfile(path):
                continue
            with open(path, "rb") as f:
                body = f.read()
            if b"\0" in body[:8192]:  # a binary file
                continue
            for n, line in enumerate(body.decode("utf-8", "replace").splitlines(), 1):
                if OLD.search(line):
                    found.append(f"{rel}:{n}: {line.strip()[:100]}")
        self.assertEqual(found, [], "use the domain kantahe.party and the identifiers party.kantahe, see kantahe-fl9")


if __name__ == "__main__":
    unittest.main()
