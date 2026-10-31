#!/usr/bin/env python3
"""The licence report of Kantahe: the licence of every third-party package that ends up in the server, the web app
and the mobile/TV app, checked against an allow list, and THIRD_PARTY_NOTICES.md generated from it.

    scripts/licenses.sh            print the direct dependencies, fail on a licence outside the allow list, on a direct
                                   dependency missing from the report, or on an out-of-date THIRD_PARTY_NOTICES.md
    scripts/licenses.sh --write    rewrite THIRD_PARTY_NOTICES.md

KANTAHE_LICENSE_ALLOW (comma separated SPDX ids) replaces the allow list; the tests use it. Go: `go list -deps`
(the modules the server is built from); npm: `npm ls --omit=dev` (what the web app ships); Dart: `flutter pub deps
--json` (the direct dependencies and what they need). A licence comes from the package's own metadata or LICENSE file."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"

# permissive licences only; GeneralUser-GS is the SoundFont's own permissive licence
ALLOWED = {"MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "ISC", "Zlib", "MPL-2.0", "0BSD", "Unlicense", "GeneralUser-GS"}

# Licences of packages whose files carry no classifiable text. Each was read by hand: say where.
OVERRIDES: dict[str, str] = {}

# Things that are not packages of an ecosystem but are part of what a release contains.
EXTRAS = [
    {
        "name": "GeneralUser GS (SoundFont)",
        "version": "the version in scripts/soundfont.lock",
        "license": "GeneralUser-GS",
        "note": "Downloaded and embedded by scripts/build-release.sh, never stored in the repository. Licence: GeneralUser GS "
        "License v2.0, a permissive licence of its own, shipped with the SoundFont at https://github.com/mrbumpy409/GeneralUser-GS .",
    },
    {
        "name": "Docker image base (gcr.io/distroless/static-debian12)",
        "version": "",
        "license": "see the image",
        "checked": False,
        "note": "The Docker image's final stage is distroless static (Debian 12 CA certificates, time zone data and base files, no shell). "
        "Their licences are in /usr/share/doc/*/copyright inside the image. Not part of the repository.",
    },
    {
        "name": "Flutter engine (inside the Android, iOS and Android TV apps)",
        "version": "",
        "license": "see the Flutter project",
        "checked": False,
        "note": "App builds contain the Flutter engine, which has third-party components of its own (Skia, ICU, FreeType, HarfBuzz and "
        "others). Their licences are in the LICENSE file of the sky_engine package of the Flutter SDK, and Flutter's own licence "
        "registry. Not part of the repository.",
    },
    {
        "name": "Fanfare clips (server/internal/assets/fanfare/fanfare1.mp3, fanfare2.mp3, fanfare3.mp3)",
        "version": "",
        "license": "UNCONFIRMED",
        "note": "Their licence is not confirmed. The owner decides: confirm it, or replace the three files under the same names "
        "(docs/PLAN.md section 10). Until then they must not be redistributed as if they were free.",
    },
]


def classify(text: str) -> str | None:
    """The SPDX id of a licence text, by its characteristic sentences; None when it is not one that is known."""
    t = re.sub(r"\s+", " ", text)
    low = t.lower()
    if "apache license" in low and "version 2.0" in low:
        return "Apache-2.0"
    if "mozilla public license" in low and "2.0" in low:
        return "MPL-2.0"
    if "gnu general public license" in low or "gnu lesser general public license" in low or "gnu affero" in low:
        return "GPL-3.0"
    if "free and unencumbered software released into the public domain" in low:
        return "Unlicense"
    if "permission is hereby granted, free of charge" in low:
        return "MIT"
    if "redistribution and use in source and binary forms" in low:
        return "BSD-3-Clause" if ("neither the name" in low or "may be used to endorse" in low) else "BSD-2-Clause"
    if "permission to use, copy, modify, and/or distribute this software for any purpose with or without fee" in low:
        return "ISC" if "provided that the above copyright notice" in low else "0BSD"
    if "this software is provided 'as-is'" in low and "altered source versions must be plainly marked" in low:
        return "Zlib"
    return None


def copyright_line(text: str) -> str:
    for line in text.splitlines():
        if re.match(r"\s*copyright\b", line, re.I):
            return line.strip()[:160]
    return ""


def is_allowed(expr: str, allowed) -> bool:
    """An SPDX expression of ids, AND, OR and parentheses: OR needs one allowed side, AND needs both."""
    tokens = re.findall(r"\(|\)|[^\s()]+", expr or "")
    if not tokens:
        return False
    pos = 0

    def parse_or():
        nonlocal pos
        v = parse_and()
        while pos < len(tokens) and tokens[pos].upper() == "OR":
            pos += 1
            r = parse_and()
            v = v or r
        return v

    def parse_and():
        nonlocal pos
        v = parse_atom()
        while pos < len(tokens) and tokens[pos].upper() == "AND":
            pos += 1
            r = parse_atom()
            v = v and r
        return v

    def parse_atom():
        nonlocal pos
        if pos >= len(tokens):
            return False
        tok = tokens[pos]
        pos += 1
        if tok == "(":
            v = parse_or()
            if pos < len(tokens) and tokens[pos] == ")":
                pos += 1
            return v
        return tok in allowed

    value = parse_or()
    return value and pos == len(tokens)


def npm_license(pkg: dict) -> str | None:
    lic = pkg.get("license")
    if isinstance(lic, str) and lic:
        return lic
    if isinstance(lic, dict) and lic.get("type"):
        return lic["type"]
    old = pkg.get("licenses")
    if isinstance(old, list) and old:
        return "(" + " OR ".join(x.get("type", "UNKNOWN") if isinstance(x, dict) else str(x) for x in old) + ")"
    return None


def go_direct(mod: str) -> list[str]:
    out, block = [], False
    for raw in mod.splitlines():
        line = raw.strip()
        if line.startswith("require ("):
            block = True
        elif block and line == ")":
            block = False
        elif block or line.startswith("require "):
            body = line.removeprefix("require ").strip()
            if body and "// indirect" not in body and not body.startswith("("):
                out.append(body.split()[0])
    return out


def pubspec_direct(yaml: str) -> list[str]:
    out, inside = [], False
    for line in yaml.splitlines():
        if re.match(r"^dependencies:\s*$", line):
            inside = True
        elif re.match(r"^\S", line):
            inside = False
        elif inside and (m := re.match(r"^  ([A-Za-z0-9_]+):", line)):
            out.append(m.group(1))
    return out


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"licenses: {' '.join(cmd)} failed in {cwd}:\n{r.stderr.strip()}")
    return r.stdout


def license_file_text(directory: Path, climb: int = 0) -> str:
    d = directory
    for _ in range(climb + 1):
        for f in sorted(d.iterdir()) if d.is_dir() else []:
            if re.fullmatch(r"(licen[cs]e|copying|unlicense)([-._].*)?", f.name, re.I) and f.is_file():
                return f.read_text(errors="replace")
        d = d.parent
    return ""


def entry(eco, name, version, direct, text="", declared=None, author="", repo=""):
    lic = OVERRIDES.get(f"{eco}:{name}") or declared or classify(text) or "UNKNOWN"
    # the Apache text itself talks about "copyright notice": there is no holder in it to show
    holder = "" if lic.startswith("Apache-2.0") else copyright_line(text)
    return {"eco": eco, "name": name, "version": version, "license": lic, "copyright": holder, "direct": direct, "text": text.strip(), "author": author, "repo": repo}


def collect_go():
    out = run(["go", "list", "-deps", "-f", "{{with .Module}}{{.Path}}\t{{.Version}}\t{{.Indirect}}\t{{.Dir}}{{end}}", "./..."], ROOT / "server")
    seen = {}
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 4 or not parts[1]:  # the main module has no version
            continue
        path, version, indirect, directory = parts
        seen[path] = entry("go", path, version, indirect != "true", license_file_text(Path(directory)))
    return sorted(seen.values(), key=lambda e: e["name"])


def collect_npm():
    tree = json.loads(run(["npm", "ls", "--omit=dev", "--all", "--json"], ROOT / "web"))
    direct = set((tree.get("dependencies") or {}).keys())
    found = {}

    def walk(node):
        for name, info in (node.get("dependencies") or {}).items():
            if info.get("version"):
                found.setdefault(name, info["version"])
            walk(info)

    walk(tree)
    out = []
    for name, version in found.items():
        d = ROOT / "web" / "node_modules" / name
        meta = json.loads((d / "package.json").read_text()) if (d / "package.json").exists() else {}
        author = meta.get("author")
        author = author.get("name", "") if isinstance(author, dict) else (author or "")
        repo = meta.get("repository")
        repo = repo.get("url", "") if isinstance(repo, dict) else (repo or "")
        out.append(entry("npm", name, version, name in direct, license_file_text(d) if d.exists() else "", npm_license(meta), author, repo))
    return sorted(out, key=lambda e: e["name"])


def collect_dart():
    app = ROOT / "app"
    deps = json.loads(run(["flutter", "pub", "deps", "--json"], app))
    by_name = {p["name"]: p for p in deps["packages"]}
    # what the app ships: the direct dependencies and everything they need (dev dependencies and what only they need are out)
    shipped, todo = set(), [p["name"] for p in deps["packages"] if p["kind"] == "direct"]
    while todo:
        n = todo.pop()
        if n not in shipped and n in by_name:
            shipped.add(n)
            todo += by_name[n].get("dependencies", [])
    roots = {p["name"]: p["rootUri"] for p in json.loads((app / ".dart_tool" / "package_config.json").read_text())["packages"]}
    out = []
    for p in deps["packages"]:
        if p["name"] not in shipped:
            continue
        uri = roots.get(p["name"], "")
        directory = (app / ".dart_tool" / uri).resolve() if not uri.startswith("file:") else Path(re.sub(r"^file://", "", uri))
        out.append(entry("dart", p["name"], p["version"], p["kind"] == "direct", license_file_text(directory, climb=3 if p.get("source") == "sdk" else 0)))
    use_flutter_licence(out)
    return sorted(out, key=lambda e: e["name"])


def use_flutter_licence(entries):
    """sky_engine is part of Flutter and has Flutter's licence; its LICENSE file is the aggregate of the engine's third-party
    licences (over a megabyte), which is not one licence text."""
    flutter = next((e for e in entries if e["name"] == "flutter"), None)
    for e in entries:
        if e["name"] == "sky_engine" and flutter:
            e.update(license=flutter["license"], text=flutter["text"], copyright=flutter["copyright"])


def direct_expected():
    pkg = json.loads((ROOT / "web" / "package.json").read_text())
    return {
        "go": go_direct((ROOT / "server" / "go.mod").read_text()),
        "npm": list((pkg.get("dependencies") or {}).keys()),
        "dart": pubspec_direct((ROOT / "app" / "pubspec.yaml").read_text()),
    }


TITLES = {"go": "Server (Go modules)", "npm": "Web app (npm packages)", "dart": "Mobile and TV app (Dart packages)"}


def texts_section(entries) -> list[str]:
    """Every distinct licence text once, with the packages it belongs to: a copy of a binary needs the text and the notice."""
    groups: dict[str, list[dict]] = {}
    for e in entries:
        key = re.sub(r"\s+", " ", e.get("text", "")).strip()
        groups.setdefault(key, []).append(e)
    lines = ["## Licence texts", "", "Each text below belongs to the packages listed above it.", ""]
    ordered = sorted(groups.items(), key=lambda kv: (kv[0] == "", kv[1][0]["license"], kv[1][0]["name"]))
    for key, members in ordered:
        names = ", ".join(f"{m['name']} {m['version']}" for m in members)
        if key == "":
            lines += ["### Packages without a licence file in the package", "", "No licence file came with these; their metadata declares the licence shown in the lists above:", ""]
            for m in members:
                who = f", by {m['author']}" if m.get("author") else ""
                where = f", {m['repo']}" if m.get("repo") else ""
                lines.append(f"- {m['name']} {m['version']}: {m['license']}{who}{where}")
            lines.append("")
            continue
        lines += [f"### {members[0]['license']}: {names}", "", "~~~~", members[0]["text"], "~~~~", ""]
    return lines


def render_notices(entries, extras) -> str:
    lines = [
        "# Third-party notices",
        "",
        "Kantahe is MIT licensed (see LICENSE). It is built from the third-party software below. This file is generated by",
        "`scripts/licenses.sh --write` from the dependency lists of the server, the web app and the app: do not edit it by hand.",
        "A licence is found from the package's own metadata or its LICENSE file; the licence texts are in the packages.",
        "Direct dependencies are marked with *.",
        "",
    ]
    for eco in ("go", "npm", "dart"):
        group = [e for e in entries if e["eco"] == eco]
        lines += [f"## {TITLES[eco]}", ""]
        for e in group:
            star = "*" if e["direct"] else ""
            tail = f" ({e['copyright']})" if e["copyright"] else ""
            lines.append(f"- {e['name']}{star} {e['version']}: {e['license']}{tail}")
        lines.append("")
    lines += texts_section(entries)
    lines += ["## Other components of a release", ""]
    for x in extras:
        lines.append(f"- **{x['name']}** {x['version']}".rstrip() + f": {x['license']}. {x['note']}")
    lines.append("")
    return "\n".join(lines)


def check(entries, allowed, direct_expected, notices) -> list[str]:
    problems = []
    for e in entries:
        if not is_allowed(e["license"], allowed):
            problems.append(f"{e['eco']}: {e['name']} {e['version']} has the licence {e['license']!r}, which is not in the allow list")
    for eco, names in direct_expected.items():
        have = {e["name"] for e in entries if e["eco"] == eco}
        problems += [f"{eco}: direct dependency {n} is missing from the report" for n in names if n not in have]
    for x in EXTRAS:
        if x.get("checked", True) and x["license"] != "UNCONFIRMED" and not is_allowed(x["license"], allowed):
            problems.append(f"extra: {x['name']} has the licence {x['license']!r}, which is not in the allow list")
    if notices != render_notices(entries, EXTRAS):
        problems.append("THIRD_PARTY_NOTICES.md is missing or out of date: run scripts/licenses.sh --write")
    return problems


def main(argv):
    allow = set(os.environ["KANTAHE_LICENSE_ALLOW"].split(",")) if os.environ.get("KANTAHE_LICENSE_ALLOW") else ALLOWED
    entries = collect_go() + collect_npm() + collect_dart()
    text = render_notices(entries, EXTRAS)
    if "--write" in argv:
        NOTICES.write_text(text)
        print(f"wrote {NOTICES.name}: {len(entries)} packages")
    current = NOTICES.read_text() if NOTICES.exists() else ""
    problems = check(entries, allow, direct_expected(), current)
    for eco in ("go", "npm", "dart"):
        group = [e for e in entries if e["eco"] == eco]
        print(f"== {TITLES[eco]}: {len(group)} packages")
        for e in group:
            if e["direct"]:
                print(f"  {e['name']} {e['version']}: {e['license']}")
    for x in EXTRAS:
        if x["license"] == "UNCONFIRMED":
            print(f"WARNING: {x['name']}: licence not confirmed (owner decision, docs/PLAN.md section 10)")
    for p in problems:
        print(f"licenses: {p}", file=sys.stderr)
    if problems:
        print("licenses: FAILED", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
