#!/usr/bin/env python3
"""What a release must satisfy before anything is published (used by .github/workflows/release.yml, tested by
scripts/test_release_checks.py):

    scripts/release-checks.py TAG --tags FILE --released FILE [--release-exists] [--dry-run]

TAG       the tag being released, for example v0.3.0 or v1.0.0-rc.1
--tags    a file with every tag of the repository, one per line (git tag --list 'v*')
--released  a file with the tags of the releases that are published and have files attached, one per line
--release-exists  a release (draft or published) for TAG exists already: the files are uploaded to it again
--dry-run  a rehearsal: a tag that is not greater than the existing ones is reported as a warning, not refused

It prints key=value lines (for $GITHUB_OUTPUT):
    prerelease=true|false     a version with a "-" suffix is a pre-release (and never moves "latest")
    mode=create|upload        create the release as a draft, or upload to the one that exists
    notes=generate|template   generate the notes from `previous` to TAG, or use the template of docs/release-notes-template.md
    previous=TAG|             the tag the generated notes start from
    warning=TEXT              only with --dry-run
and exits 1 with a message on stderr when the tag is refused.
"""
import argparse
import re
import sys

TAG = re.compile(r"^v([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z.-]+))?$")


def parse(tag):
    """(major, minor, patch, pre-release identifiers) of a tag, or None when it is not a version tag."""
    m = TAG.match(tag)
    if not m:
        return None
    pre = m.group(4).split(".") if m.group(4) else []
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), pre


def _identifier(i):
    """Numeric identifiers sort before the others and by value; the others by their characters (semver 2.0.0, item 11)."""
    return (0, int(i), "") if i.isdigit() else (1, 0, i)


def compare(a, b):
    """-1, 0 or 1: the precedence of version tag a against version tag b (semver 2.0.0: 1.0.0-rc.1 < 1.0.0)."""
    pa, pb = parse(a), parse(b)
    if pa[:3] != pb[:3]:
        return -1 if pa[:3] < pb[:3] else 1
    ia, ib = pa[3], pb[3]
    if not ia and not ib:
        return 0
    if not ia:
        return 1
    if not ib:
        return -1
    ka, kb = [_identifier(i) for i in ia], [_identifier(i) for i in ib]
    if ka == kb:
        return 0
    return -1 if ka < kb else 1  # a shorter list that is a prefix of the longer one is smaller, as list order gives


def versions(lines, besides):
    """The version tags among lines, without `besides` and without repeats."""
    seen = []
    for line in lines:
        t = line.strip()
        if t and t != besides and parse(t) and t not in seen:
            seen.append(t)
    return seen


def newest(tags):
    best = None
    for t in tags:
        if best is None or compare(t, best) > 0:
            best = t
    return best


def check(tag, all_tags, released, release_exists=False, dry_run=False):
    """The key=value results for tag; raises ValueError with the reason when the tag is refused."""
    if not parse(tag):
        raise ValueError(f"{tag!r} is not a version tag: use vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-suffix, for example v1.2.3 or v1.2.3-rc.1")
    out = {"prerelease": "true" if "-" in tag else "false"}
    out["mode"] = "upload" if release_exists else "create"
    others = versions(all_tags, tag)
    top = newest(others)
    if top is not None and compare(tag, top) <= 0:
        message = f"{tag} is not greater than the existing tag {top}"
        if not dry_run:
            raise ValueError(message)
        out["warning"] = message + " (a rehearsal: it would be refused for a real release)"
    # the notes start at the newest earlier release that has files; a stable release skips the pre-releases before it
    earlier = [t for t in versions(released, tag) if compare(t, tag) < 0 and (out["prerelease"] == "true" or "-" not in t)]
    previous = newest(earlier)
    out["notes"] = "generate" if previous else "template"
    out["previous"] = previous or ""
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("tag")
    p.add_argument("--tags", required=True)
    p.add_argument("--released", required=True)
    p.add_argument("--release-exists", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)
    with open(a.tags) as f:
        all_tags = f.read().splitlines()
    with open(a.released) as f:
        released = f.read().splitlines()
    try:
        result = check(a.tag, all_tags, released, a.release_exists, a.dry_run)
    except ValueError as e:
        print(f"release-checks: {e}", file=sys.stderr)
        return 1
    for key, value in result.items():
        print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
