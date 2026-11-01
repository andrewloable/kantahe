"""Checks of what a release must satisfy before anything is published: scripts/release-checks.py (the tag), scripts/publish-release.sh
(draft first, safe to run again; gh is replaced by a recording stub) and .github/workflows/release.yml (triggers, permissions,
concurrency, who may publish). Run by CI (scripts-and-docs) and by ci-local.sh:

    python3 -m unittest discover -s scripts -p 'test_release_checks.py'
"""
import importlib.util
import os
import re
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import testenv

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RELEASE_YML = ROOT / ".github" / "workflows" / "release.yml"

spec = importlib.util.spec_from_file_location("release_checks", HERE / "release-checks.py")
RC = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RC)


class TagCheck(unittest.TestCase):
    def ok(self, tag, tags=(), released=(), **kw):
        return RC.check(tag, list(tags), list(released), **kw)

    def refused(self, tag, tags=(), released=(), **kw):
        with self.assertRaises(ValueError) as cm:
            RC.check(tag, list(tags), list(released), **kw)
        return str(cm.exception)

    def test_the_next_version_is_ok(self):
        r = self.ok("v1.2.3", ["v1.2.2", "v1.2.3"], ["v1.2.2"])
        self.assertEqual((r["prerelease"], r["mode"], r["notes"], r["previous"]), ("false", "create", "generate", "v1.2.2"))

    def test_a_release_that_exists_is_uploaded_to_again(self):
        self.assertEqual(self.ok("v1.2.3", ["v1.2.3"], release_exists=True)["mode"], "upload")
        self.assertEqual(self.ok("v1.2.3", ["v1.2.3"])["mode"], "create")

    def test_what_is_not_a_version_tag_is_refused(self):
        for tag in ["v1.2", "v1", "vtest", "1.2.3", "v1.2.3.4", "v1.2.3+build", "v1.2.3-", "v1.2.x", "V1.2.3", "v1.2.3 ", ""]:
            self.assertIn("not a version tag", self.refused(tag, ["v0.1.0"]), repr(tag))

    def test_a_suffix_makes_a_pre_release(self):
        r = self.ok("v1.2.3-rc.1", ["v1.2.2"])
        self.assertEqual(r["prerelease"], "true")
        self.assertEqual(self.ok("v1.2.3", ["v1.2.2"])["prerelease"], "false")

    def test_an_older_or_equal_version_is_refused(self):
        self.assertIn("not greater than the existing tag v1.2.3", self.refused("v1.2.2", ["v1.2.3"]))
        self.assertIn("not greater", self.refused("v1.2.3", ["v1.2.3-rc.1", "v1.2.4"]))
        self.assertIn("not greater", self.refused("v0.2.0", ["v0.3.0", "v0.1.0"]))

    def test_the_order_is_the_one_of_semantic_versions(self):
        # the pre-release is below its version; numbers in a suffix compare as numbers; numbers sort below words
        self.assertIn("not greater", self.refused("v1.2.3-rc.1", ["v1.2.3"]))
        self.ok("v1.2.3", ["v1.2.3-rc.2"])
        self.ok("v1.2.3-rc.10", ["v1.2.3-rc.2"])
        self.assertIn("not greater", self.refused("v1.2.3-rc.2", ["v1.2.3-rc.10"]))
        self.ok("v1.2.3-rc.beta", ["v1.2.3-rc.1"])
        self.assertIn("not greater", self.refused("v1.2.3-rc", ["v1.2.3-rc.1"]), "a shorter suffix is the smaller")
        self.ok("v1.10.0", ["v1.9.9"])  # 10 is more than 9, not less as text
        self.ok("v2.0.0", ["v1.99.99"])

    def test_tags_that_are_not_versions_do_not_count(self):
        self.ok("v1.0.0", ["latest", "nightly", "v1", "v9.9", "release-2020"])

    def test_the_tag_itself_is_not_compared_with_itself(self):
        self.ok("v1.0.0", ["v1.0.0", "v0.9.0"])

    def test_a_rehearsal_warns_where_a_release_is_refused(self):
        r = self.ok("v0.0.0-dry", ["v0.2.0"], dry_run=True)
        self.assertIn("not greater than the existing tag v0.2.0", r["warning"])
        self.assertIn("not a version tag", self.refused("dry", ["v0.2.0"], dry_run=True), "the form is still checked")

    def test_the_old_release_without_files_is_not_a_start_for_the_notes(self):
        # v0.2.0 of 2020 is a tag, and a pre-release without files: GitHub lists no release with files, so the template is used
        r = self.ok("v0.3.0", ["v0.2.0"], released=[])
        self.assertEqual((r["notes"], r["previous"]), ("template", ""))

    def test_the_notes_start_at_the_newest_earlier_release_with_files(self):
        released = ["v0.3.0", "v0.4.0", "v0.4.1"]
        r = self.ok("v0.5.0", released + ["v0.5.0"], released)
        self.assertEqual((r["notes"], r["previous"]), ("generate", "v0.4.1"))

    def test_a_release_skips_the_pre_releases_before_it_and_a_pre_release_does_not(self):
        released = ["v0.3.0", "v0.4.0-rc.1", "v0.4.0-rc.2"]
        self.assertEqual(self.ok("v0.4.0", released, released)["previous"], "v0.3.0")
        self.assertEqual(self.ok("v0.4.0-rc.3", released, released)["previous"], "v0.4.0-rc.2")

    def test_the_tag_itself_is_never_its_own_start(self):
        r = self.ok("v0.4.0", ["v0.3.0"], released=["v0.3.0", "v0.4.0"], release_exists=True)
        self.assertEqual(r["previous"], "v0.3.0")


class Cli(unittest.TestCase):
    def run_cli(self, tag, tags, released, *flags):
        d = Path(tempfile.mkdtemp(prefix="kantahe-test-release."))
        self.addCleanup(lambda: [p.unlink() for p in d.iterdir()] and d.rmdir())
        (d / "tags").write_text("\n".join(tags) + "\n")
        (d / "released").write_text("\n".join(released) + "\n")
        return subprocess.run(
            [sys.executable, "-I", str(HERE / "release-checks.py"), tag, "--tags", str(d / "tags"), "--released", str(d / "released"), *flags],
            capture_output=True,
            text=True,
        )

    def test_it_prints_key_value_lines_for_github_output(self):
        r = self.run_cli("v0.3.0-rc.1", ["v0.2.0"], [])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.splitlines(), ["prerelease=true", "mode=create", "notes=template", "previous="])

    def test_a_refused_tag_fails_the_step_with_the_reason(self):
        r = self.run_cli("v1.2", [], [])
        self.assertEqual(r.returncode, 1)
        self.assertIn("not a version tag", r.stderr)
        self.assertEqual(r.stdout, "")

    def test_the_flags(self):
        r = self.run_cli("v0.0.0-dry", ["v0.2.0"], [], "--dry-run", "--release-exists")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("mode=upload", r.stdout)
        self.assertIn("warning=", r.stdout)


FAKE_GH = """#!/bin/sh
# records every call; FAKE_GH_EXISTS=1: the release exists; FAKE_GH_ASSETS: the names that are on the release after the upload
echo "$*" >> "$FAKE_GH_LOG"
case "$1 $2" in
  "release view")
    case "$*" in
      *--json*) for n in $FAKE_GH_ASSETS; do echo "$n"; done; exit 0 ;;
      *) [ "${FAKE_GH_EXISTS:-0}" = 1 ]; exit $? ;;
    esac ;;
esac
exit 0
"""


class Publish(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="kantahe-test-publish."))
        self.addCleanup(self.cleanup)
        self.bin = testenv.sandbox()
        gh = self.bin / "gh"
        gh.write_text(FAKE_GH)
        gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
        self.dist = self.tmp / "dist"
        self.dist.mkdir()
        for name in ["kantahe-v0.3.0-linux-amd64", "kantahe-v0.3.0-windows-amd64.exe", "SHA256SUMS"]:
            (self.dist / name).write_text("x")
        self.log = self.tmp / "gh.log"

    def cleanup(self):
        import shutil

        shutil.rmtree(self.tmp, True)
        shutil.rmtree(self.bin, True)

    def publish(self, *args, exists=False, assets=None):
        names = " ".join(sorted(p.name for p in self.dist.iterdir())) if assets is None else assets
        env = dict(os.environ, PATH=str(self.bin), FAKE_GH_LOG=str(self.log), FAKE_GH_EXISTS="1" if exists else "0", FAKE_GH_ASSETS=names)
        r = subprocess.run(["bash", str(HERE / "publish-release.sh"), *args], capture_output=True, text=True, env=env)
        calls = self.log.read_text().splitlines() if self.log.exists() else []
        return r, calls

    def index(self, calls, start):
        return next(i for i, c in enumerate(calls) if c.startswith(start))

    def test_a_new_release_is_a_draft_until_every_file_is_on_it(self):
        r, calls = self.publish("v0.3.0", str(self.dist), "false", "generate", "v0.2.0")
        self.assertEqual(r.returncode, 0, r.stderr)
        create, upload, check, publish = (self.index(calls, s) for s in ("release create", "release upload", "release view v0.3.0 --json", "release edit"))
        self.assertLess(create, upload)
        self.assertLess(upload, check)
        self.assertLess(check, publish)
        self.assertIn("--draft", calls[create])
        self.assertIn("--verify-tag", calls[create])
        self.assertIn("--generate-notes --notes-start-tag v0.2.0", calls[create])
        self.assertNotIn("--prerelease", calls[create])
        self.assertIn("--clobber", calls[upload])
        for name in self.dist.iterdir():
            self.assertIn(str(name), calls[upload])
        self.assertEqual(calls[publish], "release edit v0.3.0 --draft=false")

    def test_a_release_that_exists_is_not_created_again(self):
        r, calls = self.publish("v0.3.0", str(self.dist), "false", "generate", "v0.2.0", exists=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse([c for c in calls if c.startswith("release create")])
        self.assertTrue([c for c in calls if c.startswith("release upload") and "--clobber" in c])
        self.assertTrue([c for c in calls if c.startswith("release edit")])

    def test_a_pre_release_is_created_as_one(self):
        r, calls = self.publish("v0.3.0-rc.1", str(self.dist), "true", "generate", "v0.2.0")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("--prerelease", calls[self.index(calls, "release create")])

    def test_the_first_release_uses_the_template_not_generated_notes(self):
        r, calls = self.publish("v0.3.0", str(self.dist), "false", "template", "")
        self.assertEqual(r.returncode, 0, r.stderr)
        create = calls[self.index(calls, "release create")]
        self.assertNotIn("--generate-notes", create)
        self.assertNotIn("--notes-start-tag", create)
        self.assertRegex(create, r"--notes-file \S*/docs/release-notes-template\.md")
        self.assertTrue((ROOT / "docs" / "release-notes-template.md").is_file())

    def test_a_missing_file_stops_before_the_release_is_published(self):
        r, calls = self.publish("v0.3.0", str(self.dist), "false", "generate", "v0.2.0", assets="kantahe-v0.3.0-linux-amd64 SHA256SUMS")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("kantahe-v0.3.0-windows-amd64.exe is not on the release", r.stderr)
        self.assertFalse([c for c in calls if c.startswith("release edit")], "a draft must stay a draft")

    def test_nothing_to_publish_is_an_error(self):
        for p in self.dist.iterdir():
            p.unlink()
        r, calls = self.publish("v0.3.0", str(self.dist), "false", "template", "")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("no files", r.stderr)
        self.assertEqual(calls, [])

    def test_bad_arguments_are_refused_before_gh_is_called(self):
        for args in [("v0.3.0", str(self.dist), "yes", "template", ""), ("v0.3.0", str(self.dist), "false", "write", ""), ("v0.3.0", str(self.dist), "false", "generate", "")]:
            r, calls = self.publish(*args)
            self.assertNotEqual(r.returncode, 0, args)
            self.assertEqual(calls, [], args)


def top_block(text, key):
    """The lines under a top-level key of the workflow, up to the next top-level key (comments do not end it)."""
    out, inside = [], False
    for line in text.splitlines():
        if re.match(rf"^{re.escape(key)}:", line):
            inside = True
            continue
        if inside and line.startswith("#"):
            continue
        if inside and line and not line.startswith(" "):
            break
        if inside:
            out.append(line)
    return "\n".join(out)


def job_block(text, name):
    """The lines of one job under jobs:."""
    jobs = top_block(text, "jobs")
    out, inside = [], False
    for line in jobs.splitlines():
        m = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", line)
        if m:
            inside = m.group(1) == name
            continue
        if inside:
            out.append(line)
    return "\n".join(out)


class Workflow(unittest.TestCase):
    text = RELEASE_YML.read_text()

    def test_only_a_version_tag_and_a_manual_run_start_it(self):
        on = top_block(self.text, "on")
        self.assertRegex(on, r"push:\s*\n\s*tags: \['v\*'\]")
        self.assertIn("workflow_dispatch:", on)
        for trigger in ["pull_request", "pull_request_target", "branches", "schedule", "workflow_run", "release:"]:
            self.assertNotIn(trigger, on, f"the on: block of release.yml must not have {trigger}")

    def test_everything_is_read_only_unless_a_job_says_otherwise(self):
        self.assertEqual(top_block(self.text, "permissions").split(), ["contents:", "read"])

    def test_the_checks_and_the_tag_check_only_read(self):
        for name in ["plan", "checks"]:
            block = job_block(self.text, name)
            self.assertIn("contents: read", block, name)
            self.assertNotIn("write", block, name)

    def test_only_the_release_job_writes_contents_and_only_the_image_job_writes_packages(self):
        self.assertIn("contents: write", job_block(self.text, "release"))
        image = job_block(self.text, "image")
        self.assertIn("packages: write", image)
        self.assertIn("contents: read", image)
        self.assertNotIn("contents: write", image)
        self.assertEqual(self.text.count("contents: write"), 1)
        self.assertEqual(self.text.count("packages: write"), 1)

    def test_a_release_in_progress_is_never_cancelled(self):
        concurrency = top_block(self.text, "concurrency")
        self.assertIn("cancel-in-progress: false", concurrency)

    def test_releases_run_one_at_a_time_and_a_rehearsal_cannot_displace_one(self):
        group = re.search(r"group: (.*)", top_block(self.text, "concurrency")).group(1)
        # the group of a real release is one constant (not the tag), the one of a manual run is another
        self.assertEqual(re.findall(r"'([a-z-]+)'", group), ["release-rehearsal", "release"])
        self.assertNotIn("ref_name", group)
        self.assertNotIn("inputs", group)

    def test_the_tag_is_checked_before_anything_is_built(self):
        self.assertRegex(job_block(self.text, "checks"), r"needs: plan")
        for name in ["release", "image"]:
            self.assertRegex(job_block(self.text, name), r"needs: \[plan, checks\]", name)

    def test_only_a_pushed_tag_publishes(self):
        release = job_block(self.text, "release")
        step = release[release.index("scripts/publish-release.sh") - 80 : release.index("scripts/publish-release.sh")]
        self.assertIn("if: github.event_name == 'push'", step)
        self.assertIn("push: ${{ github.event_name == 'push' }}", job_block(self.text, "image"))
        login = job_block(self.text, "image")
        login = login[login.index("docker/login-action") - 80 : login.index("docker/login-action")]
        self.assertIn("if: github.event_name == 'push'", login)

    def test_a_release_is_changed_in_one_place_only(self):
        # reading is fine (the tag check asks whether a release exists); creating, uploading, editing and deleting are in the script
        self.assertNotRegex(self.text, r"gh release (create|upload|edit|delete)")
        self.assertNotRegex(self.text, r"gh api[^\n]*(-X|--method)")

    def test_a_rehearsal_keeps_the_files_as_an_artifact(self):
        release = job_block(self.text, "release")
        self.assertIn("actions/upload-artifact", release)
        self.assertRegex(release, r"upload-artifact@[^\n]*\n\s+if: github.event_name == 'workflow_dispatch'")

    def test_the_published_release_is_verified_read_only_and_only_after_a_real_release(self):
        verify = job_block(self.text, "verify")
        self.assertIn("scripts/verify-release.sh", verify)
        self.assertIn('"$TAG" --strict', verify)  # a check that was skipped is a failure here
        self.assertRegex(verify, r"needs: \[plan, release, image\]")
        self.assertIn("if: github.event_name == 'push'", verify)  # a rehearsal publishes nothing to verify
        self.assertIn("contents: read", verify)
        self.assertIn("packages: read", verify)
        self.assertNotIn("write", verify)
        self.assertIn("docker/setup-qemu-action", verify)

    def test_a_cache_that_cannot_be_written_does_not_fail_the_image(self):
        # intermittent "failed to reserve cache" errors of the GitHub Actions cache are known; the image does not depend on it
        image = job_block(self.text, "image")
        self.assertRegex(image, r"cache-to: type=gha,mode=max,ignore-error=true")
        self.assertIn("cache-from: type=gha", image)

    def test_the_latest_tag_does_not_move_for_a_pre_release(self):
        image = job_block(self.text, "image")
        self.assertIn('if [ "$PRERELEASE" != true ]; then echo "ghcr.io/andrewloable/kantahe:latest"; fi', image)


if __name__ == "__main__":
    unittest.main()
