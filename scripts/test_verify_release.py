"""Tests of scripts/verify-release.sh, which checks a published release. gh and docker are stubs, and so are the two smoke scripts (they have
tests of their own, and a real run is in the notes of kantahe-31t.9): these tests are about the orchestration and about every way a release
can be wrong. Nothing is published and nothing leaves this machine.

    python3 -m unittest discover -s scripts -p 'test_verify_release.py'
"""
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import testenv

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = HERE / "verify-release.sh"
TAG = "v1.2.3"

FAKE_DOCKER = f"""#!{sys.executable}
import json, os, sys
a = sys.argv[1:]
open(os.environ["FAKE_DOCKER_LOG"], "a").write(" ".join(a) + "\\n")
if a[:1] == ["info"]:
    sys.exit(1 if os.environ.get("FAKE_DOCKER_DOWN") else 0)
if a[:1] == ["pull"]:
    if a[a.index("--platform") + 1] in os.environ.get("FAKE_PULL_FAIL", "").split():
        print("Error: manifest unknown")
        sys.exit(1)
    sys.exit(0)
if a[:3] == ["buildx", "imagetools", "inspect"]:
    digest = json.loads(os.environ.get("FAKE_DIGESTS", "{{}}")).get(a[3], "")
    if digest:
        print(digest)
    sys.exit(0 if digest else 1)
sys.exit(0)
"""

# gh: FAKE_GH_STATE "draft prerelease" (true/false), FAKE_GH_FILES the folder that `release download` copies, FAKE_GH_NOFILES = a release without files
FAKE_GH = f"""#!{sys.executable}
import os, shutil, sys
a = sys.argv[1:]
files = os.environ.get("FAKE_GH_FILES", "")
if a[:2] == ["release", "view"] and "isDraft,isPrerelease" in a:
    print(os.environ.get("FAKE_GH_STATE", "false false"))
elif a[:2] == ["release", "view"] and "assets" in a:
    for n in sorted(os.listdir(files)) if files else []:
        print(n)
elif a[:2] == ["release", "download"]:
    if os.environ.get("FAKE_GH_DOWNLOAD_FAILS"):
        print("no assets to download"); sys.exit(1)
    dest = a[a.index("-D") + 1]
    for n in os.listdir(files):
        shutil.copy(os.path.join(files, n), os.path.join(dest, n))
else:
    sys.exit(2)
"""

LOGGING_SMOKE = """#!/bin/sh
echo "$@" >> "$FAKE_SMOKE_LOG"
[ -z "$FAKE_SMOKE_FAIL" ] || { echo "smoke: pretending to fail" >&2; exit 1; }
"""


def script(path, text):
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


def this_machine():
    system, machine = os.uname().sysname, os.uname().machine
    return {("Linux", "x86_64"): "linux-amd64", ("Linux", "aarch64"): "linux-arm64", ("Darwin", "arm64"): "darwin-arm64", ("Darwin", "x86_64"): "darwin-amd64"}.get((system, machine))


def make_release(folder, tag=TAG, files=None):
    """The seven files of a release: six binaries (any bytes) and the SHA256SUMS of them."""
    folder.mkdir(parents=True, exist_ok=True)
    names = []
    for os_ in ("linux", "darwin", "windows"):
        for arch in ("amd64", "arm64"):
            names.append(f"kantahe-{tag}-{os_}-{arch}" + (".exe" if os_ == "windows" else ""))
    for n in names:
        (folder / n).write_bytes(f"binary of {n}\n".encode())
    sums = "".join(f"{hashlib.sha256((folder / n).read_bytes()).hexdigest()}  {n}\n" for n in names)
    (folder / "SHA256SUMS").write_text(sums)
    return names


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="kantahe-test-verify."))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.bin = testenv.sandbox(extra=("comm", "chmod"))
        self.addCleanup(shutil.rmtree, self.bin, True)
        self.dist = self.tmp / "dist"
        self.names = make_release(self.dist)
        self.smoke_log = self.tmp / "smoke.log"
        self.docker_log = self.tmp / "docker.log"
        self.smoke = script(self.tmp / "smoke", LOGGING_SMOKE)

    def docker(self, **env):
        script(self.bin / "docker", FAKE_DOCKER)
        self.docker_env = env

    def run_verify(self, *args, tag=TAG, env=None, repo=None):
        e = {
            "PATH": str(self.bin),
            "HOME": str(self.tmp),
            "VERIFY_SMOKE_BINARY": self.smoke,
            "VERIFY_SMOKE_IMAGE": self.smoke,
            "FAKE_SMOKE_LOG": str(self.smoke_log),
            "FAKE_DOCKER_LOG": str(self.docker_log),
        }
        e.update(getattr(self, "docker_env", {}))
        e.update(env or {})
        exe = str((repo or HERE) / ("verify-release.sh" if repo is None else "scripts/verify-release.sh"))
        return subprocess.run(["bash", exe, tag, *args], capture_output=True, text=True, env=e, timeout=60)

    def calls(self, path):
        return path.read_text().splitlines() if path.exists() else []


class FromDir(Base):
    def test_a_correct_release_passes_and_says_what_it_checked(self):
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for line in ["exactly the 7 expected files", "SHA256SUMS lists exactly the six binaries", "docs/install.md still shows the checksum command", "verify-release: v1.2.3 ok"]:
            self.assertIn(line, r.stdout)

    def test_strict_turns_a_skipped_check_into_a_failure(self):
        r = self.run_verify("--from-dir", str(self.dist), "--strict")
        self.assertEqual(r.returncode, 1)
        self.assertIn("skipped and --strict is on", r.stderr)

    def test_a_missing_file_fails_and_is_named(self):
        (self.dist / f"kantahe-{TAG}-windows-arm64.exe").unlink()
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 1)
        self.assertIn(f"the file kantahe-{TAG}-windows-arm64.exe is missing from the release", r.stderr)

    def test_a_release_without_its_checksums_fails(self):
        (self.dist / "SHA256SUMS").unlink()
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 1)
        self.assertIn("SHA256SUMS is missing from the release", r.stderr)

    def test_an_unexpected_file_fails(self):
        (self.dist / "notes.txt").write_text("x")
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 1)
        self.assertIn("the release has an unexpected file: notes.txt", r.stderr)

    def test_six_files_are_not_enough(self):
        # all binaries but the checksum file: "accept 6 files" must be refused
        (self.dist / "SHA256SUMS").unlink()
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertNotIn("exactly the 7 expected files", r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_a_corrupted_binary_fails_the_checksum(self):
        target = self.dist / f"kantahe-{TAG}-linux-arm64"
        target.write_bytes(target.read_bytes() + b"x")
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 1)
        self.assertIn("does not match SHA256SUMS", r.stderr)
        self.assertIn("FAILED", r.stderr)

    def test_checksums_that_do_not_list_the_six_binaries_fail(self):
        lines = (self.dist / "SHA256SUMS").read_text().splitlines()
        (self.dist / "SHA256SUMS").write_text("\n".join(lines[:-1]) + "\n")
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 1)
        self.assertIn("SHA256SUMS does not list exactly the six binaries", r.stderr)

    def test_the_binary_of_this_machine_goes_through_the_smoke_test(self):
        mine = this_machine()
        if not mine:
            self.skipTest("no release binary runs on this machine")
        r = self.run_verify("--from-dir", str(self.dist))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        calls = self.calls(self.smoke_log)
        self.assertEqual(len(calls), 1, calls)
        binary, tag = calls[0].split()
        self.assertTrue(binary.endswith(f"kantahe-{TAG}-{mine}"), binary)
        self.assertEqual(tag, TAG)

    def test_a_binary_that_does_not_start_fails_the_smoke_test(self):
        mine = this_machine()
        if not mine:
            self.skipTest("no release binary runs on this machine")
        broken = self.dist / f"kantahe-{TAG}-{mine}"
        broken.write_text("#!/bin/sh\nexit 1\n")
        sums = "".join(f"{hashlib.sha256((self.dist / n).read_bytes()).hexdigest()}  {n}\n" for n in self.names)
        (self.dist / "SHA256SUMS").write_text(sums)
        # the real smoke script this time
        r = self.run_verify("--from-dir", str(self.dist), env={"VERIFY_SMOKE_BINARY": str(HERE / "smoke-release.sh")})
        self.assertEqual(r.returncode, 1)
        self.assertIn(f"kantahe-{TAG}-{mine} does not pass the smoke test", r.stderr)
        self.assertIn("wrong --version output", r.stderr)

    def test_a_smoke_test_that_fails_fails_the_verification(self):
        r = self.run_verify("--from-dir", str(self.dist), env={"FAKE_SMOKE_FAIL": "1"})
        if this_machine():
            self.assertEqual(r.returncode, 1)
            self.assertIn("does not pass the smoke test", r.stderr)

    def test_the_input_folder_is_left_as_it_was(self):
        before = {p.name: p.stat().st_mode for p in self.dist.iterdir()}
        self.run_verify("--from-dir", str(self.dist))
        self.assertEqual({p.name: p.stat().st_mode for p in self.dist.iterdir()}, before)

    def test_the_usage_is_checked(self):
        for args, tag in [([], "1.2.3"), ([], "v1.2"), ([], "vtest"), (["--nope"], TAG)]:
            self.assertEqual(self.run_verify(*args, tag=tag).returncode, 2, (args, tag))
        self.assertEqual(self.run_verify("--from-dir", str(self.tmp / "nothing")).returncode, 2)

    def test_the_checksum_command_of_the_install_guide_is_checked_against_the_guide(self):
        repo = self.tmp / "repo"
        (repo / "scripts").mkdir(parents=True)
        (repo / "docs").mkdir()
        shutil.copy(SCRIPT, repo / "scripts" / "verify-release.sh")
        (repo / "docs" / "install.md").write_text("Check the download with some other command.\n")
        r = self.run_verify("--from-dir", str(self.dist), repo=repo)
        self.assertEqual(r.returncode, 1)
        self.assertIn("docs/install.md no longer shows", r.stderr)


    def fake_repo(self, install_md, compose_yaml):
        repo = self.tmp / "repo"
        (repo / "scripts").mkdir(parents=True)
        (repo / "docs").mkdir()
        (repo / "deploy").mkdir()
        shutil.copy(SCRIPT, repo / "scripts" / "verify-release.sh")
        (repo / "docs" / "install.md").write_text(install_md)
        (repo / "deploy" / "compose.yaml").write_text(compose_yaml)
        return repo

    GOOD_MD = "Check with sha256sum -c --ignore-missing SHA256SUMS\n"

    def test_the_image_of_the_compose_file_is_the_one_that_is_verified(self):
        repo = self.fake_repo(self.GOOD_MD, "services:\n  kantahe:\n    image: ghcr.io/someone-else/kantahe:latest\n")
        r = self.run_verify("--from-dir", str(self.dist), repo=repo)
        self.assertEqual(r.returncode, 1)
        self.assertIn("deploy/compose.yaml does not use ghcr.io/andrewloable/kantahe:latest", r.stderr)

    def test_a_compose_file_with_the_verified_image_passes(self):
        repo = self.fake_repo(self.GOOD_MD, "services:\n  kantahe:\n    image: ghcr.io/andrewloable/kantahe:latest\n")
        r = self.run_verify("--from-dir", str(self.dist), repo=repo)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("deploy/compose.yaml pulls ghcr.io/andrewloable/kantahe:latest", r.stdout)


class Arm64Binary(Base):
    def smoked(self):
        return self.calls(self.smoke_log)

    def run_linux(self, **env):
        return self.run_verify("--from-dir", str(self.dist), env=dict({"VERIFY_MACHINE": "linux-amd64", "VERIFY_BINFMT_QEMU": str(self.tmp / "nothing")}, **env))

    def test_the_arm64_binary_is_run_through_a_qemu_command_when_there_is_one(self):
        script(self.bin / "qemu-aarch64", "#!/bin/sh\nexit 0\n")
        r = self.run_linux()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("(under qemu-aarch64)", r.stdout)
        self.assertEqual(len(self.smoked()), 2, self.smoked())  # the amd64 binary and the arm64 one

    def test_the_arm64_binary_is_run_directly_when_the_kernel_has_the_qemu_handler(self):
        handler = self.tmp / "qemu-aarch64"
        handler.write_text("enabled\n")
        r = self.run_linux(VERIFY_BINFMT_QEMU=str(handler))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("through the kernel's qemu handler", r.stdout)
        self.assertTrue(self.smoked()[-1].split()[0].endswith(f"kantahe-{TAG}-linux-arm64"), self.smoked())

    def test_without_any_qemu_the_arm64_binary_is_skipped_and_strict_fails(self):
        r = self.run_linux()
        self.assertEqual(r.returncode, 0)
        self.assertIn("skipped:  linux-arm64: no qemu-user here to run it", r.stdout)
        self.assertEqual(len(self.smoked()), 1)
        self.assertEqual(self.run_linux().returncode, 0)
        r = self.run_verify("--from-dir", str(self.dist), "--strict", env={"VERIFY_MACHINE": "linux-amd64", "VERIFY_BINFMT_QEMU": str(self.tmp / "nothing")})
        self.assertEqual(r.returncode, 1)

    def test_a_failing_arm64_smoke_test_fails(self):
        script(self.bin / "qemu-aarch64", "#!/bin/sh\nexit 0\n")
        r = self.run_linux(FAKE_SMOKE_FAIL="1")
        self.assertEqual(r.returncode, 1)
        self.assertIn("linux-arm64 (under qemu-aarch64) does not pass the smoke test", r.stderr)

    def test_an_unknown_machine_has_no_binary_to_run(self):
        r = self.run_verify("--from-dir", str(self.dist), env={"VERIFY_MACHINE": "plan9-mips"})
        self.assertIn("no binary of this release runs on", r.stdout)
        self.assertEqual(self.smoked(), [])


class Image(Base):
    LATEST = "ghcr.io/andrewloable/kantahe:latest"

    def image(self, tag=TAG):
        return f"ghcr.io/andrewloable/kantahe:{tag}"

    def verify(self, digests, tag=TAG, **env):
        self.docker(FAKE_DIGESTS=json.dumps(digests), **env)
        if tag != TAG:
            shutil.rmtree(self.dist)
            make_release(self.dist, tag)
        return self.run_verify("--from-dir", str(self.dist), "--image", self.image(tag), "--latest-image", self.LATEST, tag=tag)

    def test_both_platforms_are_pulled_and_smoked(self):
        r = self.verify({self.image(): "sha256:aaa", self.LATEST: "sha256:aaa"})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        pulls = [c for c in self.calls(self.docker_log) if c.startswith("pull")]
        self.assertEqual(pulls, [f"pull --platform linux/amd64 {self.image()}", f"pull --platform linux/arm64 {self.image()}"])
        smokes = [c for c in self.calls(self.smoke_log) if self.image() in c]
        self.assertEqual(smokes, [f"{self.image()} {TAG} linux/amd64", f"{self.image()} {TAG} linux/arm64"])
        self.assertIn(":latest is v1.2.3", r.stdout)

    def test_a_platform_that_cannot_be_pulled_fails(self):
        r = self.verify({self.image(): "sha256:aaa", self.LATEST: "sha256:aaa"}, FAKE_PULL_FAIL="linux/arm64")
        self.assertEqual(r.returncode, 1)
        self.assertIn(f"the image {self.image()} cannot be pulled for linux/arm64", r.stderr)

    def test_an_image_that_fails_its_smoke_test_fails(self):
        r = self.verify({self.image(): "sha256:aaa", self.LATEST: "sha256:aaa"}, FAKE_SMOKE_FAIL="1")
        self.assertEqual(r.returncode, 1)
        self.assertIn("the image does not pass the smoke test on linux/amd64", r.stderr)

    def test_latest_must_be_the_final_version(self):
        r = self.verify({self.image(): "sha256:aaa", self.LATEST: "sha256:bbb"})
        self.assertEqual(r.returncode, 1)
        self.assertIn(":latest is sha256:bbb, not v1.2.3 (sha256:aaa)", r.stderr)

    def test_a_missing_latest_fails_for_a_final_version(self):
        r = self.verify({self.image(): "sha256:aaa"})
        self.assertEqual(r.returncode, 1)
        self.assertIn(":latest is missing", r.stderr)

    def test_a_pre_release_must_not_move_latest(self):
        pre = "v1.2.3-rc.1"
        r = self.verify({self.image(pre): "sha256:aaa", self.LATEST: "sha256:aaa"}, tag=pre)
        self.assertEqual(r.returncode, 1)
        self.assertIn(f":latest moved to the pre-release {pre}", r.stderr)

    def test_a_pre_release_that_left_latest_alone_passes(self):
        pre = "v1.2.3-rc.1"
        r = self.verify({self.image(pre): "sha256:aaa", self.LATEST: "sha256:bbb"}, tag=pre)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn(":latest did not move to the pre-release (it is sha256:bbb)", r.stdout)

    def test_a_pre_release_without_any_latest_passes(self):
        pre = "v1.2.3-rc.1"
        r = self.verify({self.image(pre): "sha256:aaa"}, tag=pre)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("there is no :latest yet", r.stdout)

    def test_without_docker_the_image_checks_are_skipped_not_passed(self):
        self.docker(FAKE_DOCKER_DOWN="1")
        r = self.run_verify("--from-dir", str(self.dist), "--image", self.image())
        self.assertEqual(r.returncode, 0)
        self.assertIn("skipped:  Docker is not available", r.stdout)
        self.assertEqual(self.run_verify("--from-dir", str(self.dist), "--strict").returncode, 1)

    def test_no_docker_switches_the_image_checks_off(self):
        self.docker()
        r = self.run_verify("--from-dir", str(self.dist), "--no-docker")
        self.assertIn("switched off", r.stdout)
        self.assertEqual([c for c in self.calls(self.docker_log) if c.startswith("pull")], [])

    def test_the_image_is_not_compared_with_latest_when_nothing_stands_for_it(self):
        self.docker(FAKE_DIGESTS=json.dumps({}))
        r = self.run_verify("--from-dir", str(self.dist), "--image", self.image())
        self.assertIn("no image stands for :latest", r.stdout)


class FromGitHub(Base):
    def run_gh(self, state="false false", **env):
        script(self.bin / "gh", FAKE_GH)
        return self.run_verify(env=dict({"FAKE_GH_STATE": state, "FAKE_GH_FILES": str(self.dist)}, **env), *["--no-docker"])

    def test_a_good_release_passes(self):
        r = self.run_gh()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("the release is published, not a draft", r.stdout)
        self.assertIn("pre-release flag is false, as for v1.2.3", r.stdout)

    def test_a_draft_fails(self):
        r = self.run_gh("true false")
        self.assertEqual(r.returncode, 1)
        self.assertIn("the release is still a draft", r.stderr)

    def test_the_pre_release_flag_must_match_the_tag(self):
        r = self.run_gh("false true")
        self.assertEqual(r.returncode, 1)
        self.assertIn("marked pre-release=true, but v1.2.3 needs false", r.stderr)
        script(self.bin / "gh", FAKE_GH)
        pre = "v1.2.3-rc.1"
        make_release(self.dist, pre)
        for n in self.names:
            (self.dist / n).unlink()
        r = self.run_verify("--no-docker", tag=pre, env={"FAKE_GH_STATE": "false false", "FAKE_GH_FILES": str(self.dist)})
        self.assertEqual(r.returncode, 1)
        self.assertIn("marked pre-release=false, but v1.2.3-rc.1 needs true", r.stderr)

    def test_a_release_without_files_fails(self):
        for p in self.dist.iterdir():
            p.unlink()
        r = self.run_gh(FAKE_GH_DOWNLOAD_FAILS="1")
        self.assertEqual(r.returncode, 1)
        self.assertIn("the files cannot be downloaded", r.stderr)
        self.assertIn("is missing from the release", r.stderr)

    def test_a_release_that_cannot_be_read_fails(self):
        script(self.bin / "gh", "#!/bin/sh\nexit 1\n")
        r = self.run_verify("--no-docker")
        self.assertEqual(r.returncode, 1)
        self.assertIn("cannot be read", r.stderr)

    def test_gh_is_needed_without_from_dir(self):
        r = self.run_verify("--no-docker")
        self.assertEqual(r.returncode, 2)
        self.assertIn("gh is needed", r.stderr)

    def test_only_reading_commands_are_used(self):
        log = self.tmp / "gh.log"
        script(self.bin / "gh", FAKE_GH.replace("a = sys.argv[1:]\n", f"a = sys.argv[1:]\nopen({str(log)!r}, 'a').write(' '.join(a) + '\\n')\n", 1))
        self.run_verify("--no-docker", env={"FAKE_GH_STATE": "false false", "FAKE_GH_FILES": str(self.dist)})
        verbs = {" ".join(c.split()[:2]) for c in self.calls(log)}
        self.assertEqual(verbs, {"release view", "release download"})


if __name__ == "__main__":
    unittest.main()
