#!/usr/bin/env python3
"""Checks the relative links, images and #anchors of the Markdown files (default: README.md, THIRD_PARTY_NOTICES.md, CLAUDE.md
and every docs/*.md). Links to other sites are not fetched. Exit 1 with one line per broken link.

    python3 scripts/check-links.py [--root DIR] [FILE ...]
"""
import re
import sys
from pathlib import Path
from urllib.parse import unquote

INLINE = re.compile(r"!?\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>]*>|[^)\s]*)(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)")
REFDEF = re.compile(r"^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)", re.M)
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$", re.M)


def strip_code(text: str) -> str:
    """The text with fenced blocks and inline code replaced by blanks of the same lines, so that line numbers survive."""
    text = re.sub(r"^(```|~~~).*?^\1[^\n]*$", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.M | re.S)
    return re.sub(r"`[^`\n]*`", lambda m: " " * len(m.group(0)), text)


def slug(heading: str) -> str:
    """GitHub's anchor of a heading: lower case, punctuation dropped, spaces become minus signs."""
    h = re.sub(r"<[^>]+>|[*_`]", "", heading).strip().lower()
    h = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", h)
    h = re.sub(r"[^\w\- ]", "", h)
    return h.replace(" ", "-")


def anchors(path: Path) -> set[str]:
    seen: dict[str, int] = {}
    out = set()
    for m in HEADING.finditer(strip_code(path.read_text())):
        s = slug(m.group(2))
        n = seen.get(s, 0)
        seen[s] = n + 1
        out.add(s if n == 0 else f"{s}-{n}")
    return out


def targets(text: str):
    """(line number, target) of every link in the text outside code."""
    body = strip_code(text)
    for pat in (INLINE, REFDEF):
        for m in pat.finditer(body):
            yield body.count("\n", 0, m.start()) + 1, m.group(1).strip("<>")
    for m in re.finditer(r"<(https?://[^>\s]+)>", body):
        yield body.count("\n", 0, m.start()) + 1, m.group(1)


def check(files: list[Path], root: Path) -> list[str]:
    root = root.resolve()
    problems = []
    cache: dict[Path, set[str]] = {}
    for f in files:
        f = f.resolve()
        for line, target in targets(f.read_text()):
            if not target or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):  # https:, mailto:, ...
                continue
            where = f"{f.relative_to(root)}:{line}"
            ref, _, frag = target.partition("#")
            ref = unquote(ref.split("?", 1)[0])
            dest = f if ref == "" else (f.parent / ref).resolve()
            if root not in dest.parents and dest != root:
                problems.append(f"{where}: {target} leaves the repository")
                continue
            if not dest.exists():
                problems.append(f"{where}: {target}: no such file {dest.relative_to(root)}")
                continue
            if frag and dest.suffix.lower() == ".md":
                found = cache.setdefault(dest, anchors(dest))
                if unquote(frag).lower() not in found:
                    problems.append(f"{where}: {target}: no heading #{frag} in {dest.relative_to(root)}")
    return problems


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parents[1]
    if "--root" in argv:
        i = argv.index("--root")
        root = Path(argv[i + 1])
        del argv[i : i + 2]
    files = [root / a for a in argv] or [p for p in [root / "README.md", root / "THIRD_PARTY_NOTICES.md", root / "CLAUDE.md", *sorted((root / "docs").glob("*.md"))] if p.exists()]
    problems = check(files, root)
    for p in problems:
        print(f"check-links: {p}", file=sys.stderr)
    print(f"check-links: {len(files)} files, {len(problems)} broken links")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
