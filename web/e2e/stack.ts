import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { APP_PORT, APP_URL, SERVER_PORT, SERVER_URL } from './ports';

export const repo = resolve(__dirname, '../..');

function stop(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM'); // the whole group: ng serve starts helpers
  } catch {
    child.kill('SIGTERM');
  }
  setTimeout(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      // already gone
    }
  }, 5000).unref();
}

function tail(log: string): string {
  try {
    return readFileSync(log, 'utf8').split('\n').slice(-25).join('\n');
  } catch {
    return '';
  }
}

async function waitFor(url: string, what: string, log: string, child: ChildProcess, ms = 120_000): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${what} stopped at once (exit code ${child.exitCode}).\n${tail(log)}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > until) throw new Error(`${what} did not come up at ${url} within ${ms / 1000} s.\n${tail(log)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Something already listens on the port (whatever it speaks). */
function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function requirePortFree(port: number, what: string): Promise<void> {
  if (await portInUse(port)) throw new Error(`${what} port ${port} is already in use; stop what runs there and try again.`);
}

/**
 * The real server with a synthetic library behind the Angular dev server, in a temp folder of its own that stop() removes.
 * Call build(), then fixtures() for the songs, startServer(), startApp(); stop() also after a failure.
 */
export class Stack {
  readonly work: string;
  readonly bin: string;
  private readonly children: ChildProcess[] = [];

  constructor(prefix: string) {
    this.work = mkdtempSync(join(tmpdir(), prefix));
    this.bin = join(this.work, 'bin');
  }

  /** Checks that the ports are free and builds the server and the generator of the synthetic songs. */
  async build(): Promise<void> {
    await requirePortFree(SERVER_PORT, 'The server');
    await requirePortFree(APP_PORT, 'The web app');
    mkdirSync(this.bin);
    const env = { ...process.env, CGO_ENABLED: '0' };
    execFileSync('go', ['build', '-o', join(this.bin, 'kantahe'), './cmd/kantahe'], { cwd: join(repo, 'server'), env, stdio: 'inherit' });
    execFileSync('go', ['build', '-o', join(this.bin, 'kantahe-fixtures'), './cmd/kantahe-fixtures'], { cwd: join(repo, 'server'), env, stdio: 'inherit' });
  }

  /** Runs kantahe-fixtures with these arguments (it lists every file it writes unless quiet). */
  fixtures(args: string[], quiet = false): void {
    execFileSync(join(this.bin, 'kantahe-fixtures'), args, { stdio: quiet ? 'ignore' : 'inherit' });
  }

  /** Starts the server on its test port with these flags (listen address and data folder are added) and waits until it answers. */
  async startServer(flags: string[]): Promise<void> {
    const log = join(this.work, 'server.log');
    const server = spawn(join(this.bin, 'kantahe'), ['--listen', `127.0.0.1:${SERVER_PORT}`, '--data', join(this.work, 'data'), ...flags], {
      stdio: ['ignore', openSync(log, 'a'), openSync(log, 'a')],
      detached: true,
    });
    this.children.push(server);
    await waitFor(`${SERVER_URL}/healthz`, 'The server', log, server);
  }

  /** Starts the dev server, which forwards the API and the media to the server (the port is written here, not in the repo). */
  async startApp(): Promise<void> {
    const proxy = join(this.work, 'proxy.conf.json');
    writeFileSync(proxy, JSON.stringify({ '/kantahe.v1.': { target: SERVER_URL, secure: false }, '/media': { target: SERVER_URL, secure: false } }));
    const log = join(this.work, 'ng.log');
    const web = spawn('npx', ['ng', 'serve', '--host', '127.0.0.1', '--port', String(APP_PORT), '--proxy-config', proxy], {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', openSync(log, 'a'), openSync(log, 'a')],
      detached: true,
    });
    this.children.push(web);
    await waitFor(`${APP_URL}/`, 'The web app', log, web, 240_000);
    // a first request through the proxy must reach the server
    const info = await fetch(`${APP_URL}/kantahe.v1.AuthService/GetServerInfo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!info.ok) throw new Error(`The proxy to the server does not work (${info.status}).`);
  }

  /** Stops both servers and removes the temp folder. */
  async stop(): Promise<void> {
    this.children.forEach(stop);
    await new Promise((r) => setTimeout(r, 500));
    rmSync(this.work, { recursive: true, force: true });
  }
}
