"""A hermetic PATH for the tests of the scripts: only the tools a script needs, so that what a machine happens to have
installed (docker, nginx, caddy, flutter: a CI runner has some of them, a Mac others) cannot change the outcome."""
import shutil
import tempfile
from pathlib import Path

# what ci-local.sh, check-proxy-configs.sh and build-release.sh use, and nothing of the "optional" tools
COMMON = [
    "bash", "sh", "env", "git", "sed", "tr", "wc", "date", "mktemp", "tee", "cat", "head", "tail", "uname", "awk", "rm", "mkdir", "touch",
    "dirname", "sort", "cut", "grep", "find", "ls", "cp", "mv", "openssl", "curl", "shasum", "sha256sum", "basename", "xargs", "sleep",
]


def sandbox(extra=()):
    """A new folder with a symlink to each of COMMON (and extra) that this machine has; returns it as a Path."""
    d = Path(tempfile.mkdtemp(prefix="kantahe-test-bin."))
    for name in [*COMMON, *extra]:
        found = shutil.which(name)
        if found:
            (d / name).symlink_to(found)
    return d
