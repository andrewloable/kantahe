"""Tests of scripts/smoke-windows.py, which runs on the Windows runner (go-windows job of ci.yml). Here it runs against a stub
that behaves like the program, and, for the service mode, a fake sc that keeps the state of one service. They check the
orchestration (order of the sc calls, limits, the service is deleted even when a step fails, the log is printed) and the reading
of `sc query`; that Windows really behaves so is what the Windows runner shows.

    python3 -m unittest discover -s scripts -p 'test_smoke_windows.py'
"""
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SMOKE = HERE / "smoke-windows.py"

# a stand-in for kantahe: --version, --listen HOST:PORT, --data DIR; STUB_MODE picks a misbehaviour
STUB = f"""#!{sys.executable}
import http.server, os, signal, sys, threading
args = sys.argv[1:]
if args == ["--version"]:
    print("kantahe v1.2.3"); sys.exit(0)
listen = args[args.index("--listen") + 1]; data = args[args.index("--data") + 1]
mode = os.environ.get("STUB_MODE", "")
if mode == "exit":
    print("boom: cannot open the database", file=sys.stderr); sys.exit(3)
open(os.path.join(data, "kantahe.db"), "w").write("db")
if mode == "deaf":
    signal.signal(signal.SIGINT, signal.SIG_IGN)
host, port = listen.rsplit(":", 1)
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if mode == "silent" and self.path == "/healthz":
            return  # never answers: the request times out on the other side
        code, ctype, body = 200, "text/html", b"<html></html>"
        if self.path == "/healthz": ctype, body = "text/plain", b"ok"
        elif mode == "404" and self.path == "/library": code = 404
        elif mode == "json" and self.path == "/": ctype = "application/json"
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer((host, int(port)), H)
signal.signal(signal.SIGTERM, lambda *a: threading.Thread(target=srv.shutdown).start())
if mode != "deaf":
    signal.signal(signal.SIGINT, lambda *a: threading.Thread(target=srv.shutdown).start())
srv.serve_forever()
"""

# a stand-in for sc.exe: one service, its state in FAKE_SC_DIR; FAKE_SC_MODE crash | stuck
FAKE_SC = f"""#!{sys.executable}
import json, os, shlex, signal, subprocess, sys, time
d = os.environ["FAKE_SC_DIR"]; mode = os.environ.get("FAKE_SC_MODE", "")
a = sys.argv[1:]
open(os.path.join(d, "calls"), "a").write(" ".join(a[:2]) + "\\n")
pidfile = os.path.join(d, "pid"); cmdfile = os.path.join(d, "cmd"); stopped = os.path.join(d, "stopped")
def alive():
    try:
        pid = int(open(pidfile).read())
        os.kill(pid, 0)
        return not os.path.exists(stopped)
    except (OSError, ValueError):
        return False
def reap():
    try: os.waitpid(int(open(pidfile).read()), os.WNOHANG)
    except (OSError, ValueError): pass
if a[0] == "create":
    open(cmdfile, "w").write(json.dumps(a)); open(os.path.join(d, "create.json"), "w").write(json.dumps(a)); print("[SC] CreateService SUCCESS")
elif a[0] == "start":
    cmd = json.loads(open(cmdfile).read())[3]
    if os.path.exists(stopped): os.remove(stopped)
    p = subprocess.Popen(shlex.split(cmd), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=dict(os.environ, STUB_MODE="exit" if mode == "crash" else ""))
    open(pidfile, "w").write(str(p.pid)); print("SERVICE_NAME: Kantahe\\n  STATE : 2  START_PENDING")
elif a[0] == "stop":
    if mode != "stuck" and alive():
        os.kill(int(open(pidfile).read()), signal.SIGINT); reap(); time.sleep(0.3); reap()
    print("SERVICE_NAME: Kantahe\\n        STATE              : 3  STOP_PENDING")
elif a[0] == "query":
    reap()
    st = "4  RUNNING" if alive() else "1  STOPPED"
    if not os.path.exists(cmdfile): print("[SC] EnumQueryServicesStatus:OpenService FAILED 1060:\\n\\nThe specified service does not exist as an installed service."); sys.exit(1)
    print("SERVICE_NAME: Kantahe \\n        TYPE               : 10  WIN32_OWN_PROCESS  \\n        STATE              : " + st + " \\n                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)\\n        WIN32_EXIT_CODE    : 0  (0x0)")
elif a[0] == "qc":
    print("[SC] QueryServiceConfig SUCCESS\\n        BINARY_PATH_NAME   : " + json.loads(open(cmdfile).read())[3])
elif a[0] == "delete":
    os.remove(cmdfile); print("[SC] DeleteService SUCCESS")
else:
    print("description ok")
"""


def script(path, text):
    path.write_text(text)
    path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return str(path)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="kantahe-test-smoke."))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.stub = script(self.tmp / "kantahe-stub", STUB)

    def run_smoke(self, *args, **env):
        e = dict(os.environ, SMOKE_START_WITHIN="3", SMOKE_STOP_WITHIN="3", SMOKE_INTERRUPT_WITHIN="1.5", **env)
        return subprocess.run([sys.executable, "-I", str(SMOKE), *args], capture_output=True, text=True, env=e, timeout=60)


class Console(Base):
    def test_a_program_that_serves_and_stops_passes(self):
        r = self.run_smoke("console", self.stub, "v1.2.3")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for line in ["ok: kantahe v1.2.3", "ok: /healthz", "ok: /, /library", "ok: stopped on interrupt", "ok: the data folder was deleted", "smoke-windows: ok"]:
            self.assertIn(line, r.stdout)

    def test_the_version_is_checked_when_given(self):
        r = self.run_smoke("console", self.stub, "v9.9.9")
        self.assertEqual(r.returncode, 1)
        self.assertIn("want 'kantahe v9.9.9'", r.stderr)

    def test_a_binary_that_does_not_exist_fails(self):
        r = self.run_smoke("console", str(self.tmp / "nothing.exe"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("does not exist", r.stderr)

    def test_a_program_that_exits_at_once_fails_and_its_log_is_printed(self):
        r = self.run_smoke("console", self.stub, STUB_MODE="exit")
        self.assertEqual(r.returncode, 1)
        self.assertIn("stopped before it answered /healthz", r.stderr)
        self.assertIn("boom: cannot open the database", r.stdout)

    def test_a_program_that_never_answers_fails_within_the_limit(self):
        r = self.run_smoke("console", self.stub, STUB_MODE="silent")
        self.assertEqual(r.returncode, 1)
        self.assertIn("/healthz did not answer within 3 seconds", r.stderr)

    def test_a_page_that_is_not_served_fails(self):
        r = self.run_smoke("console", self.stub, STUB_MODE="404")
        self.assertEqual(r.returncode, 1)
        self.assertIn("GET /library: 404", r.stderr)

    def test_a_page_that_is_not_html_fails(self):
        r = self.run_smoke("console", self.stub, STUB_MODE="json")
        self.assertEqual(r.returncode, 1)
        self.assertIn("GET /: 200 'application/json', want 200 text/html", r.stderr)

    def test_a_program_that_ignores_the_interrupt_is_killed_with_a_warning_not_a_failure(self):
        r = self.run_smoke("console", self.stub, STUB_MODE="deaf")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("::warning::the program did not stop within 1.5 seconds", r.stdout)
        self.assertIn("ok: the data folder was deleted", r.stdout)

    def test_the_usage_is_checked(self):
        for args in [(), ("console",), ("service",), ("other", "x"), ("service", "x", "y")]:
            self.assertEqual(self.run_smoke(*args).returncode, 2, args)

    def test_no_process_is_left_behind(self):
        # the port is free again once the smoke test is over
        r = self.run_smoke("console", self.stub, STUB_MODE="deaf")
        self.assertEqual(r.returncode, 0)
        port = int(next(line for line in r.stdout.splitlines() if "port" in line).rsplit("port ", 1)[1])
        import socket

        with socket.socket() as s:
            # SO_REUSEADDR: connections in TIME_WAIT are not a process; a program that still listens would fail the bind
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("127.0.0.1", port))


class Service(Base):
    def setUp(self):
        super().setUp()
        self.state = self.tmp / "sc-state"
        self.state.mkdir()
        self.sc = script(self.tmp / "sc", FAKE_SC)
        self.addCleanup(self.stop_the_service_process)

    def stop_the_service_process(self):
        """The fake sc in the stuck mode never stops its process: end it here."""
        import signal

        try:
            os.kill(int((self.state / "pid").read_text()), signal.SIGKILL)
        except (OSError, ValueError):
            pass

    def run_service(self, **env):
        return self.run_smoke("service", self.stub, SMOKE_SC=self.sc, FAKE_SC_DIR=str(self.state), **env)

    def calls(self):
        return (self.state / "calls").read_text().splitlines()

    def test_the_documented_steps_run_in_order_and_the_service_is_deleted(self):
        r = self.run_service()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        calls = [c.split()[0] for c in self.calls()]
        order = [calls.index(x) for x in ["create", "description", "start", "stop", "delete"]]
        self.assertEqual(order, sorted(order), calls)
        self.assertIn("ok: stopped after", r.stdout)
        self.assertFalse((self.state / "cmd").exists(), "the service is deleted")

    def test_the_command_line_is_the_one_of_the_documentation(self):
        import json

        self.run_service()
        # docs/install.md: sc.exe create Kantahe binPath= "\"C:\Kantahe\kantahe.exe\" --data ..." start= auto
        args = json.loads((self.state / "create.json").read_text())
        self.assertEqual([args[0], args[1], args[2], args[4], args[5]], ["create", "Kantahe", "binPath=", "start=", "auto"])
        self.assertRegex(args[3], r'^".*kantahe-stub" --listen 127\.0\.0\.1:\d+ --data ".+"$')

    def test_a_service_that_stops_at_once_fails_with_what_the_manager_says_and_is_still_deleted(self):
        r = self.run_service(FAKE_SC_MODE="crash")
        self.assertEqual(r.returncode, 1)
        self.assertIn("the program stopped before it answered /healthz", r.stderr)
        self.assertIn("as the manager sees it", r.stdout)
        self.assertIn("BINARY_PATH_NAME", r.stdout)
        self.assertIn("delete", [c.split()[0] for c in self.calls()])
        self.assertFalse((self.state / "cmd").exists())

    def test_a_failed_service_run_leaves_no_data_folder_behind(self):
        import json

        for mode in ("crash", "stuck"):
            r = self.run_service(FAKE_SC_MODE=mode)
            self.assertEqual(r.returncode, 1, mode)
            create = json.loads((self.state / "create.json").read_text())
            data = create[3].rsplit('--data "', 1)[1].rstrip('"')
            self.assertFalse(os.path.exists(data), f"{mode}: the data folder {data} is still there")
            self.stop_the_service_process()

    def test_a_service_that_does_not_stop_in_time_fails_and_is_still_deleted(self):
        r = self.run_service(FAKE_SC_MODE="stuck")
        self.assertEqual(r.returncode, 1)
        self.assertIn("is not STOPPED 3 seconds after sc stop", r.stderr)
        self.assertIn("delete", [c.split()[0] for c in self.calls()])

    def test_the_service_mode_needs_windows_when_there_is_no_fake_sc(self):
        if sys.platform == "win32":
            self.skipTest("this is Windows")
        e = {k: v for k, v in os.environ.items() if k != "SMOKE_SC"}
        r = subprocess.run([sys.executable, "-I", str(SMOKE), "service", self.stub], capture_output=True, text=True, env=e)
        self.assertEqual(r.returncode, 1)
        self.assertIn("needs Windows", r.stderr)


if __name__ == "__main__":
    unittest.main()
