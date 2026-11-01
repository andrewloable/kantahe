"""Checks of scripts/check-proxy-configs.sh with fake nginx, caddy and docker programs: which of them it trusts.

nginx needs 1.25.1 or newer for "http2 on;" (deploy/proxy/nginx.conf), and the nginx of an Ubuntu runner is older; the
script must then use the Docker image instead of failing on a server that is simply too old.

    python3 -m unittest discover -s scripts -p 'test_check_proxy_configs.py'
"""
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

import testenv

ROOT = Path(__file__).resolve().parents[1]


def program(path, body):
    path.write_text("#!/bin/sh\n" + body)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class Fake:
    """A folder of fake programs and the log they write their calls to."""

    def __init__(self, nginx=None, caddy="v2.8.4", docker=True):
        self.dir = Path(tempfile.mkdtemp(prefix="kantahe-test-proxy."))
        self.tools = testenv.sandbox()  # no nginx, caddy or docker of the machine: only the fake ones below
        self.log = self.dir / "calls.log"
        self.log.write_text("")
        if nginx:
            program(self.dir / "nginx", f'''case "$1" in -v) echo "nginx version: nginx/{nginx}" >&2 ;; *) echo "nginx $*" >> "{self.log}" ;; esac\nexit 0\n''')
        if caddy:
            program(self.dir / "caddy", f'''case "$1" in version) echo "{caddy} h1:abc" ;; *) echo "caddy $*" >> "{self.log}" ;; esac\nexit 0\n''')
        if docker:
            program(self.dir / "docker", f'echo "docker $*" >> "{self.log}"\nexit 0\n')

    def calls(self):
        return self.log.read_text().splitlines()

    def close(self):
        shutil.rmtree(self.dir, True)
        shutil.rmtree(self.tools, True)


def run(fake, root=ROOT, **env):
    e = dict(os.environ, PATH=f"{fake.dir}:{fake.tools}", **env)
    return subprocess.run(["bash", str(root / "scripts" / "check-proxy-configs.sh")], capture_output=True, text=True, env=e)


class Choice(unittest.TestCase):
    def check(self, fake):
        self.addCleanup(fake.close)
        r = run(fake)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        return r, fake.calls()

    def nginx_calls(self, calls):
        return ([c for c in calls if c.startswith("nginx ")], [c for c in calls if c.startswith("docker ") and "nginx" in c])

    def test_regression_an_nginx_older_than_1_25_1_is_not_used_the_image_is(self):
        r, calls = self.check(Fake(nginx="1.24.0"))
        local, docker = self.nginx_calls(calls)
        self.assertEqual(local, [], "the old nginx would reject http2 on")
        self.assertEqual(len(docker), 1)
        self.assertIn("nginx: docker", r.stdout)

    def test_1_9_is_older_than_1_25_a_version_is_compared_by_numbers_not_by_text(self):
        _, calls = self.check(Fake(nginx="1.9.15"))
        local, docker = self.nginx_calls(calls)
        self.assertEqual(local, [])
        self.assertEqual(len(docker), 1)

    def test_1_25_1_is_the_first_version_that_is_used(self):
        r, calls = self.check(Fake(nginx="1.25.1"))
        local, docker = self.nginx_calls(calls)
        self.assertEqual(len(local), 1)
        self.assertEqual(docker, [])
        self.assertIn("nginx: local 1.25.1", r.stdout)

    def test_1_25_0_is_not(self):
        _, calls = self.check(Fake(nginx="1.25.0"))
        self.assertEqual(self.nginx_calls(calls)[0], [])

    def test_a_new_nginx_is_used(self):
        _, calls = self.check(Fake(nginx="1.27.3"))
        local, docker = self.nginx_calls(calls)
        self.assertEqual(len(local), 1)
        self.assertEqual(docker, [])

    def test_no_local_nginx_means_the_image(self):
        _, calls = self.check(Fake(nginx=None))
        self.assertEqual(len(self.nginx_calls(calls)[1]), 1)

    def test_check_proxy_use_docker_forces_the_images_even_with_new_local_servers(self):
        fake = Fake(nginx="1.27.3", caddy="v2.8.4")
        self.addCleanup(fake.close)
        r = run(fake, CHECK_PROXY_USE_DOCKER="1")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        calls = fake.calls()
        self.assertEqual([c for c in calls if c.startswith(("nginx ", "caddy "))], [])
        self.assertEqual(len([c for c in calls if c.startswith("docker ")]), 2)

    def test_caddy_v2_is_used_locally_and_caddy_v1_is_not(self):
        _, calls = self.check(Fake(nginx="1.27.3", caddy="v2.8.4"))
        self.assertEqual(len([c for c in calls if c.startswith("caddy ")]), 1)
        _, calls = self.check(Fake(nginx="1.27.3", caddy="v1.0.4"))
        self.assertEqual([c for c in calls if c.startswith("caddy ")], [])
        self.assertEqual(len([c for c in calls if c.startswith("docker ") and "caddy" in c]), 1)


class Checks(unittest.TestCase):
    def test_the_existing_checks_still_fail_on_a_config_without_a_required_setting(self):
        root = Path(tempfile.mkdtemp(prefix="kantahe-test-proxy-root."))
        self.addCleanup(shutil.rmtree, root, True)
        (root / "scripts").mkdir()
        (root / "deploy" / "proxy").mkdir(parents=True)
        shutil.copy(ROOT / "scripts" / "check-proxy-configs.sh", root / "scripts")
        for name in ("Caddyfile", "nginx.conf"):
            shutil.copy(ROOT / "deploy" / "proxy" / name, root / "deploy" / "proxy" / name)
        conf = (root / "deploy" / "proxy" / "nginx.conf").read_text()
        self.assertIn("client_max_body_size 64m;", conf)
        (root / "deploy" / "proxy" / "nginx.conf").write_text(conf.replace("client_max_body_size 64m;", ""))
        fake = Fake(nginx="1.27.3")
        self.addCleanup(fake.close)
        r = run(fake, root=root)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("client_max_body_size 64m missing", r.stderr)


if __name__ == "__main__":
    unittest.main()
