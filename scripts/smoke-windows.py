#!/usr/bin/env python3
"""Starts the real kantahe program, as a console program or as a Windows service, and checks that it serves, stops and leaves
nothing behind. Written in Python so that the same file runs on the Windows runner and on a Mac (scripts/test_smoke_windows.py
tests it there against stubs); the Windows-only part is the service mode.

    scripts/smoke-windows.py console BINARY [VERSION]
        starts BINARY with a new data folder and a free port, waits for /healthz, gets / and /library (200, text/html),
        interrupts it (Ctrl+Break on Windows), then deletes the data folder: a handle left open would stop that.
    scripts/smoke-windows.py service BINARY
        the service path of docs/install.md, with sc.exe: create, start, wait for /healthz, get the pages, stop (must be
        stopped within 30 seconds), delete. Needs an administrator (the runner is one).

A failure prints what went wrong, the log of the program (a service has no console: sc.exe query and qc instead) and exits 1.
SMOKE_SC names another program for sc.exe: the tests use a fake one.
"""
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

SC = os.environ.get("SMOKE_SC", "sc.exe")
SERVICE = "Kantahe"
WINDOWS = sys.platform == "win32"
# the limits are seconds; the environment shortens them for the tests of this script
START_WITHIN = float(os.environ.get("SMOKE_START_WITHIN", 30))  # until /healthz answers
STOP_WITHIN = float(os.environ.get("SMOKE_STOP_WITHIN", 30))  # until a stopped service is STOPPED (docs/install.md says "within a few seconds")
INTERRUPT_WITHIN = float(os.environ.get("SMOKE_INTERRUPT_WITHIN", 15))  # a console program has after Ctrl+Break


class Failure(Exception):
    pass


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# no proxy: the program is on this machine, and a proxy of the environment must not stand between
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def fetch(url):
    """(status, content type, body) of a GET; an error status is a result, a refused connection is None."""
    try:
        with OPENER.open(url, timeout=5) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), ""
    except (urllib.error.URLError, OSError):
        return None


def wait_healthy(port, alive, seconds=START_WITHIN):
    """Waits for /healthz; alive() says whether it is still worth waiting."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        got = fetch(f"http://127.0.0.1:{port}/healthz")
        if got and got[0] == 200:
            return
        if not alive():
            raise Failure("the program stopped before it answered /healthz")
        time.sleep(0.25)
    raise Failure(f"/healthz did not answer within {seconds:g} seconds")


def check_pages(port):
    for path in ("/", "/library"):
        got = fetch(f"http://127.0.0.1:{port}{path}")
        if not got:
            raise Failure(f"GET {path}: no answer")
        status, ctype, _ = got
        if status != 200 or not ctype.startswith("text/html"):
            raise Failure(f"GET {path}: {status} {ctype!r}, want 200 text/html")
    print("ok: /, /library")


def remove_folder(path):
    """The data folder must be deletable once the program is gone; a few tries, because a virus scanner may look at a new file."""
    last = None
    for _ in range(10):
        try:
            shutil.rmtree(path)
            print("ok: the data folder was deleted (no handle left open)")
            return
        except OSError as e:
            last = e
            time.sleep(0.5)
    raise Failure(f"the data folder cannot be deleted after the program stopped (a handle is left open): {last}")


def interrupt(proc):
    """Ctrl+Break on Windows (the program was started in a process group of its own), SIGINT elsewhere. True when it stopped."""
    try:
        proc.send_signal(signal.CTRL_BREAK_EVENT if WINDOWS else signal.SIGINT)
        proc.wait(INTERRUPT_WITHIN)
        return True
    except subprocess.TimeoutExpired:
        return False
    except OSError as e:
        print(f"warning: the interrupt could not be sent: {e}")
        return False


def console(binary, version=None):
    if not os.path.exists(binary):
        raise Failure(f"{binary} does not exist")
    binary = os.path.abspath(binary)  # a bare name would be looked up in the PATH, not in this folder
    if version:
        out = subprocess.run([binary, "--version"], capture_output=True, text=True).stdout.strip()
        if out != f"kantahe {version}":
            raise Failure(f"--version printed {out!r}, want 'kantahe {version}'")
        print(f"ok: {out}")
    data = tempfile.mkdtemp(prefix="kantahe-smoke-data.")
    logs = tempfile.mkdtemp(prefix="kantahe-smoke-log.")
    log = os.path.join(logs, "log")
    port = free_port()
    try:
        with open(log, "w") as out:
            proc = subprocess.Popen(
                [binary, "--listen", f"127.0.0.1:{port}", "--data", data],
                stdout=out,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0,
            )
            try:
                wait_healthy(port, lambda: proc.poll() is None)
                print(f"ok: /healthz on port {port}")
                check_pages(port)
                if interrupt(proc):
                    print("ok: stopped on interrupt")
                else:
                    print(f"::warning::the program did not stop within {INTERRUPT_WITHIN:g} seconds of the interrupt; it was killed")
                    proc.kill()
                    proc.wait(10)
            finally:
                if proc.poll() is None:
                    proc.kill()
                    proc.wait(10)
        remove_folder(data)
    except Failure:
        with open(log, errors="replace") as f:
            print("---- log of the program ----")
            print(f.read())
        raise
    finally:
        shutil.rmtree(logs, True)
        shutil.rmtree(data, True)


def sc(*args, check=True, quiet=False):
    r = subprocess.run([SC, *args], capture_output=True, text=True)
    if not quiet:
        print(f"$ sc {' '.join(args)}\n{r.stdout.strip()}{r.stderr.strip()}")
    if check and r.returncode != 0:
        raise Failure(f"sc {args[0]} failed with exit code {r.returncode}")
    return r.stdout


def state():
    """RUNNING, STOPPED, START_PENDING ... of the service, from `sc query`."""
    m = re.search(r"STATE\s*:\s*\d+\s+([A-Z_]+)", sc("query", SERVICE, check=False, quiet=True))
    return m.group(1) if m else "UNKNOWN"


def stop_and_delete_service():
    """Whatever state the service is in: stop it (a stop that was done already is no error here), wait, delete it."""
    sc("stop", SERVICE, check=False)
    deadline = time.monotonic() + STOP_WITHIN
    while state() not in ("STOPPED", "UNKNOWN") and time.monotonic() < deadline:
        time.sleep(0.25)
    sc("delete", SERVICE, check=False)


def service(binary):
    if not WINDOWS and "SMOKE_SC" not in os.environ:
        raise Failure("the service mode needs Windows")
    if not os.path.exists(binary):
        raise Failure(f"{binary} does not exist")
    binary = os.path.abspath(binary)
    data = tempfile.mkdtemp(prefix="kantahe-smoke-data.")
    port = free_port()
    created = False
    try:
        # the command line of docs/install.md: sc.exe create Kantahe binPath= "\"C:\Kantahe\kantahe.exe\" --data ..." start= auto
        # (a list: Python quotes the one argument with spaces exactly the way the document shows)
        sc("create", SERVICE, "binPath=", f'"{binary}" --listen 127.0.0.1:{port} --data "{data}"', "start=", "auto")
        created = True
        sc("description", SERVICE, "Kantahe karaoke server")
        sc("start", SERVICE)
        wait_healthy(port, lambda: state() in ("RUNNING", "START_PENDING"))
        print(f"ok: the service answers /healthz on port {port}")
        check_pages(port)
        if state() != "RUNNING":
            raise Failure(f"the service is {state()}, want RUNNING")
        started = time.monotonic()
        sc("stop", SERVICE)
        while state() != "STOPPED":
            if time.monotonic() - started > STOP_WITHIN:
                raise Failure(f"the service is not STOPPED {STOP_WITHIN:g} seconds after sc stop")
            time.sleep(0.25)
        print(f"ok: stopped after {time.monotonic() - started:.1f} seconds")
        # the service has to be gone before its folder can be: a running program holds files open in it
        stop_and_delete_service()
        created = False
        remove_folder(data)
    except Failure:
        print("---- the service, as the manager sees it (it has no console: its log lines are not kept) ----")
        if created:
            sc("query", SERVICE, check=False)
            sc("qc", SERVICE, check=False)
        raise
    finally:
        if created:
            stop_and_delete_service()
        shutil.rmtree(data, True)


def main(argv):
    usage = "usage: smoke-windows.py console BINARY [VERSION] | service BINARY"
    if len(argv) < 3 or argv[1] not in ("console", "service") or (argv[1] == "service" and len(argv) != 3) or len(argv) > 4:
        print(usage, file=sys.stderr)
        return 2
    try:
        if argv[1] == "console":
            console(argv[2], argv[3] if len(argv) > 3 else None)
        else:
            service(argv[2])
    except Failure as e:
        print(f"smoke-windows: FAILED: {e}", file=sys.stderr)
        return 1
    print("smoke-windows: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
