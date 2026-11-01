"""Checks of scripts/ci-local.sh: it covers every step of .github/workflows/ci.yml (so that a new CI step without a local
counterpart fails here), and it does what its header promises. Run by CI (scripts-and-docs) and by ci-local.sh itself:

    python3 -m unittest discover -s scripts -p 'test_ci_local.py'
"""
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import testenv

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ci-local.sh"
CI = ROOT / ".github" / "workflows" / "ci.yml"


def norm(text):
    """Whitespace collapsed, and the matrix expression of the docker job written the way the script spells it."""
    return re.sub(r"\s+", " ", text.replace("${{ matrix.platform }}", "$platform")).strip()


def run_commands(ci_text):
    """Every command line of every `run:` of the workflow (a block scalar gives one command per line)."""
    lines = ci_text.splitlines()
    commands = []
    i = 0
    while i < len(lines):
        m = re.match(r"^(\s*)(?:- )?run:\s*(.*)$", lines[i])
        if not m:
            i += 1
            continue
        key_indent = len(m.group(1)) + (2 if lines[i].lstrip().startswith("- ") else 0)
        value = m.group(2).strip()
        if value in ("|", "|-", ">", ">-"):
            i += 1
            while i < len(lines) and (not lines[i].strip() or len(lines[i]) - len(lines[i].lstrip()) > key_indent):
                if lines[i].strip():
                    commands.append(lines[i].strip())
                i += 1
            continue
        commands.append(value)
        i += 1
    return commands


def job_names(ci_text):
    """The keys under the top-level `jobs:`."""
    names = []
    in_jobs = False
    for line in ci_text.splitlines():
        if re.match(r"^jobs:\s*$", line):
            in_jobs = True
        elif in_jobs and re.match(r"^\S", line):
            break
        elif in_jobs:
            m = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", line)
            if m:
                names.append(m.group(1))
    return names


def split_job(ci_text, name):
    """(the lines of the workflow without job `name`, the lines of that job): cut by position, because other jobs have the same lines."""
    rest, job = [], []
    inside, in_jobs = False, False
    for line in ci_text.splitlines():
        if re.match(r"^jobs:\s*$", line):
            in_jobs = True
        elif in_jobs and re.match(r"^\S", line):
            in_jobs = inside = False
        m = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", line) if in_jobs else None
        if m:
            inside = m.group(1) == name
        (job if inside else rest).append(line)
    return rest, job


def job_lines(ci_text, name):
    """The lines of one job under jobs:, header included."""
    return split_job(ci_text, name)[1]


def without_job(ci_text, name):
    """The workflow without the lines of one job."""
    return "\n".join(split_job(ci_text, name)[0])


# The go-windows job runs on Windows, which ci-local.sh cannot. Its job is stood for by windows-compile, and each of its steps is
# mapped here to the command of the script that does the part that can be done on this machine (the smoke steps by the tests of
# the smoke script, which run it against stubs). A step that is not in this table has no counterpart: test_every_step_of_the_
# windows_job_is_mapped fails.
JOB_STANDS_FOR = {"go-windows": "windows-compile"}
WINDOWS_STEPS = {
    "go vet ./...": "GOOS=windows GOARCH=amd64 go vet ./...",
    "CGO_ENABLED=0 go build ./...": "CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build ./...",
    "go test ./... 2>&1 | tee ../windows-test.log": 'GOOS=windows GOARCH=amd64 go test -c -o "$dir/" ./...',
    "go build -o kantahe.exe ./cmd/kantahe": 'GOOS=windows GOARCH=amd64 go build -o "$dir/kantahe.exe" ./cmd/kantahe',
    "python ../scripts/smoke-windows.py console kantahe.exe": "python3 -m unittest discover -s scripts -p 'test_smoke_windows.py'",
    "python ../scripts/smoke-windows.py service kantahe.exe": "python3 -m unittest discover -s scripts -p 'test_smoke_windows.py'",
}


def unmapped_windows_steps(ci_text, script_text):
    """The steps of go-windows that are not in WINDOWS_STEPS, and the mapped commands that the script does not contain."""
    steps = [c for c in run_commands("\n".join(job_lines(ci_text, "go-windows"))) if c]  # "run:" under defaults: has no command
    script = norm(script_text)
    missing = [c for c in steps if c not in WINDOWS_STEPS]
    missing += [WINDOWS_STEPS[c] for c in steps if c in WINDOWS_STEPS and norm(WINDOWS_STEPS[c]) not in script]
    return missing


def uncovered(ci_text, script_text):
    """The run: commands of the workflow that the script does not contain."""
    script = norm(script_text)
    return [c for c in run_commands(ci_text) if norm(c) not in script]


def git(*args, cwd):
    env = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@example.test", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@example.test")
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, env=env, check=True)


def temp_repo(files, commit_files=None):
    """A git repository with the script in it; only commit_files (default all of files) are committed."""
    d = Path(tempfile.mkdtemp(prefix="kantahe-test-ci-local."))
    git("init", "-q", cwd=d)
    (d / "scripts").mkdir()
    shutil.copy(SCRIPT, d / "scripts" / "ci-local.sh")
    for name, text in files.items():
        p = d / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
    git("add", *(commit_files if commit_files is not None else list(files)), cwd=d)
    git("commit", "-q", "-m", "test", cwd=d)
    return d


def run_script(repo, *args, path=None, env=None):
    env = dict(os.environ, **(env or {}))
    if path is not None:
        env["PATH"] = path
    return subprocess.run(["bash", str(repo / "scripts" / "ci-local.sh"), *args], cwd=repo, capture_output=True, text=True, env=env)


class Coverage(unittest.TestCase):
    def test_every_run_command_of_ci_yml_is_in_the_script(self):
        # the steps of the Windows job are covered through windows-compile, below
        self.assertEqual(uncovered(without_job(CI.read_text(), "go-windows"), SCRIPT.read_text()), [])

    def test_every_step_of_the_windows_job_is_mapped_to_a_command_the_script_runs(self):
        self.assertEqual(unmapped_windows_steps(CI.read_text(), SCRIPT.read_text()), [])
        self.assertEqual(len([c for c in run_commands("\n".join(job_lines(CI.read_text(), "go-windows"))) if c]), len(WINDOWS_STEPS), "the parser sees the steps of go-windows")

    def test_the_windows_job_cannot_hang_for_hours(self):
        # GitHub's default is six hours; a stuck service or test on the runner would hold the whole release for that long
        job = "\n".join(job_lines(CI.read_text(), "go-windows"))
        self.assertRegex(job, r"timeout-minutes: (?:[1-9]|[1-5][0-9]|60)\b")

    def test_a_new_windows_step_without_a_counterpart_is_caught(self):
        extra = CI.read_text().replace("      - run: go build -o kantahe.exe ./cmd/kantahe\n", "      - run: go build -o kantahe.exe ./cmd/kantahe\n      - run: echo new-windows-check\n")
        self.assertEqual(unmapped_windows_steps(extra, SCRIPT.read_text()), ["echo new-windows-check"])

    def test_a_mapped_command_that_the_script_lost_is_caught(self):
        lost = SCRIPT.read_text().replace(" go test -c -o ", " go test -o ")
        self.assertEqual(unmapped_windows_steps(CI.read_text(), lost), ['GOOS=windows GOARCH=amd64 go test -c -o "$dir/" ./...'])

    def test_a_new_ci_step_without_a_local_counterpart_is_caught(self):
        extra = CI.read_text() + "\n      - run: echo new-check\n"
        self.assertEqual(uncovered(without_job(extra, "go-windows"), SCRIPT.read_text()), ["echo new-check"])

    def test_the_parser_sees_the_commands_it_should(self):
        commands = run_commands(CI.read_text())
        for expected in ["go vet ./...", "npm ci", "scripts/check-proxy-configs.sh", "sudo install -d /srv/karaoke", "flutter build apk --debug"]:
            self.assertIn(expected, commands)
        self.assertGreater(len(commands), 40)

    def test_every_job_of_ci_yml_is_a_job_of_the_script(self):
        listed = subprocess.run(["bash", str(SCRIPT), "--list"], capture_output=True, text=True).stdout.split()
        for name in job_names(CI.read_text()):
            self.assertIn(JOB_STANDS_FOR.get(name, name), listed, f"ci.yml has a job {name} that ci-local.sh does not run")


class Script(unittest.TestCase):
    def test_the_syntax_is_valid(self):
        self.assertEqual(subprocess.run(["bash", "-n", str(SCRIPT)]).returncode, 0)

    def test_an_unknown_option_or_job_is_refused(self):
        self.assertEqual(subprocess.run(["bash", str(SCRIPT), "--nope"], capture_output=True).returncode, 2)
        self.assertEqual(subprocess.run(["bash", str(SCRIPT), "--only", "nonsense"], capture_output=True).returncode, 2)

    def test_the_sandbox_hides_the_tools_of_the_machine_but_has_the_ones_a_script_needs(self):
        tools = testenv.sandbox()
        self.addCleanup(shutil.rmtree, tools, True)
        for hidden in ("docker", "nginx", "caddy", "flutter", "node", "go"):
            self.assertIsNone(shutil.which(hidden, path=str(tools)), hidden)
        for needed in ("bash", "git", "sed", "awk"):
            self.assertIsNotNone(shutil.which(needed, path=str(tools)), needed)

    def windows_repo(self, windows_source):
        files = {
            "server/go.mod": "module proof\n\ngo 1.21\n",
            "server/main.go": "package main\n\nfunc main() {}\n",
            "server/cmd/kantahe/main.go": "package main\n\nfunc main() {}\n",
            "server/cmd/kantahe/service_windows.go": windows_source,
            ".github/workflows/ci.yml": "name: x\n",
        }
        repo = temp_repo(files)
        self.addCleanup(shutil.rmtree, repo, True)
        return repo

    @unittest.skipUnless(shutil.which("go"), "needs Go")
    def test_windows_compile_fails_on_a_compile_error_that_only_exists_on_windows(self):
        repo = self.windows_repo("//go:build windows\n\npackage main\n\nfunc init() { notDefinedAnywhere() }\n")
        r = run_script(repo, "--only", "windows-compile")
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("notDefinedAnywhere", r.stdout + r.stderr)
        ok = run_script(self.windows_repo("//go:build windows\n\npackage main\n\nfunc init() {}\n"), "--only", "windows-compile")
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)

    @unittest.skipUnless(shutil.which("go"), "needs Go")
    def test_regression_a_file_that_is_not_committed_does_not_count(self):
        # the class of failure that broke the first release run: a test refers to a helper that exists only in the working tree
        repo = temp_repo(
            {
                "server/go.mod": "module proof\n\ngo 1.21\n",
                "server/a_test.go": 'package proof\n\nimport "testing"\n\nfunc TestA(t *testing.T) { helper() }\n',
                "server/helper.go": "package proof\n\nfunc helper() {}\n",
            },
            commit_files=["server/go.mod", "server/a_test.go"],
        )
        self.addCleanup(shutil.rmtree, repo, True)
        local = subprocess.run(["go", "test", "./..."], cwd=repo / "server", capture_output=True, text=True)
        self.assertEqual(local.returncode, 0, "in the working tree the test passes: " + local.stdout + local.stderr)
        r = run_script(repo, "--only", "go")
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("undefined: helper", r.stdout)
        self.assertIn("FAILED", r.stdout)
        self.assertIn("uncommitted or untracked", r.stdout)
        self.assertIn("server/helper.go", r.stdout)

    def test_the_jobs_run_in_a_separate_worktree_and_the_working_tree_is_left_alone(self):
        repo = temp_repo({"server/go.mod": "module proof\n\ngo 1.21\n", "a.txt": "committed\n"})
        self.addCleanup(shutil.rmtree, repo, True)
        (repo / "a.txt").write_text("changed in the working tree\n")
        (repo / "untracked.txt").write_text("x\n")
        r = run_script(repo, "--only", "deploy-files")  # fails (no proxy script in the temp repo) but must not touch the tree
        self.assertEqual((repo / "a.txt").read_text(), "changed in the working tree\n")
        self.assertTrue((repo / "untracked.txt").exists())
        self.assertEqual(git("worktree", "list", cwd=repo).stdout.strip().count("\n"), 0, "the worktree is removed on exit")
        self.assertIn("checked out clean in a separate worktree", r.stdout)

    def test_a_missing_tool_is_reported_not_silent_and_fails_only_with_strict(self):
        repo = temp_repo({"server/go.mod": "module proof\n\ngo 1.21\n"})
        self.addCleanup(shutil.rmtree, repo, True)
        tools = testenv.sandbox()  # only what the script needs: no flutter, whatever this machine has
        self.addCleanup(shutil.rmtree, tools, True)
        bare = str(tools)
        self.assertIsNone(shutil.which("flutter", path=bare))
        r = run_script(repo, "--only", "flutter", path=bare)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("skipped: flutter not installed", r.stdout)
        strict = run_script(repo, "--only", "flutter", "--strict", path=bare)
        self.assertNotEqual(strict.returncode, 0)

    def test_deploy_files_is_skipped_with_a_reason_when_neither_caddy_and_nginx_nor_docker_can_run(self):
        repo = temp_repo({"server/go.mod": "module proof\n\ngo 1.21\n"})
        self.addCleanup(shutil.rmtree, repo, True)
        tools = testenv.sandbox()  # a CI runner has a real docker in /usr/bin with a running daemon: the sandbox has none
        self.addCleanup(shutil.rmtree, tools, True)
        bare = str(tools)
        self.assertIsNone(shutil.which("caddy", path=bare))
        self.assertIsNone(shutil.which("docker", path=bare))
        r = run_script(repo, "--only", "deploy-files", path=bare)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("skipped: needs caddy and nginx, or a running Docker daemon", r.stdout)

    def stub_actionlint(self, output, status):
        """A command that stands for actionlint: prints a finding (or nothing) and exits with status."""
        d = Path(tempfile.mkdtemp(prefix="kantahe-test-actionlint."))
        self.addCleanup(shutil.rmtree, d, True)
        stub = d / "actionlint"
        stub.write_text(f"#!/bin/sh\necho '{output}'\nexit {status}\n")
        stub.chmod(0o755)
        return str(stub)

    def lint_repo(self):
        files = {"server/go.mod": "module proof\n\ngo 1.21\n", ".github/workflows/ci.yml": "name: x\n"}
        # the script is committed too: the lint job runs shellcheck on scripts/*.sh of the checkout
        repo = temp_repo(files, commit_files=[*files, "scripts/ci-local.sh"])
        self.addCleanup(shutil.rmtree, repo, True)
        return repo

    def test_actionlint_findings_fail_the_run(self):
        # a stub, not the real tool: the unit tests download nothing (go run package@version asks the module proxy)
        stub = self.stub_actionlint('ci.yml:5:14: label "ubuntu-latst" is unknown [runner-label]', 1)
        r = run_script(self.lint_repo(), "--only", "lint", env={"CI_LOCAL_ACTIONLINT": stub})
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("ubuntu-latst", r.stdout)

    def test_a_clean_actionlint_run_passes(self):
        r = run_script(self.lint_repo(), "--only", "lint", env={"CI_LOCAL_ACTIONLINT": self.stub_actionlint("", 0)})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    @unittest.skipUnless(os.environ.get("KANTAHE_TEST_ONLINE") == "1" and shutil.which("go"), "set KANTAHE_TEST_ONLINE=1 (and have Go) to run the real actionlint, which is downloaded")
    def test_the_real_actionlint_flags_a_wrong_runner_label(self):
        bad = "name: x\non: workflow_dispatch\njobs:\n  j:\n    runs-on: ubuntu-latst\n    steps:\n      - run: echo hi\n"
        repo = temp_repo({"server/go.mod": "module proof\n\ngo 1.21\n", ".github/workflows/ci.yml": bad})
        self.addCleanup(shutil.rmtree, repo, True)
        r = run_script(repo, "--only", "lint")
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn("ubuntu-latst", r.stdout)


if __name__ == "__main__":
    unittest.main()
