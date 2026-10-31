import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { APP_PORT, APP_URL, SERVER_PORT, SERVER_URL } from './ports';

const repo = resolve(__dirname, '../..');
const children: ChildProcess[] = [];

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

/** Starts the real server and the dev server; the returned function stops them and removes the temp files. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const work = mkdtempSync(join(tmpdir(), 'kantahe-e2e-'));
  const teardown = async () => {
    children.forEach(stop);
    await new Promise((r) => setTimeout(r, 500));
    rmSync(work, { recursive: true, force: true });
  };
  try {
    await requirePortFree(SERVER_PORT, 'The server');
    await requirePortFree(APP_PORT, 'The web app');
    const bin = join(work, 'bin');
    mkdirSync(bin);
    const env = { ...process.env, CGO_ENABLED: '0' };
    execFileSync('go', ['build', '-o', join(bin, 'kantahe'), './cmd/kantahe'], { cwd: join(repo, 'server'), env, stdio: 'inherit' });
    execFileSync('go', ['build', '-o', join(bin, 'kantahe-fixtures'), './cmd/kantahe-fixtures'], { cwd: join(repo, 'server'), env, stdio: 'inherit' });

    // the songs the server finds in its folder, and the ones an administrator uploads: other numbers
    const library = join(work, 'library');
    const uploads = join(work, 'uploads');
    const font = join(work, 'test.sf2');
    execFileSync(join(bin, 'kantahe-fixtures'), ['-out', library, '-mp3', '3', '-midi', '4', '-sf2', font], { stdio: 'inherit' });
    execFileSync(join(bin, 'kantahe-fixtures'), ['-out', uploads, '-first', '20', '-mp3', '1', '-midi', '2'], { stdio: 'inherit' });
    process.env['E2E_UPLOAD_DIR'] = uploads;

    const serverLog = join(work, 'server.log');
    const server = spawn(
      join(bin, 'kantahe'),
      ['--listen', `127.0.0.1:${SERVER_PORT}`, '--data', join(work, 'data'), '--library', library, '--soundfont', font, '--score-seconds', '3'],
      { stdio: ['ignore', openSync(serverLog, 'a'), openSync(serverLog, 'a')], detached: true },
    );
    children.push(server);
    await waitFor(`${SERVER_URL}/healthz`, 'The server', serverLog, server);

    // the dev server forwards the API and the media to this server (the port is written here, not in the repo)
    const proxy = join(work, 'proxy.conf.json');
    writeFileSync(proxy, JSON.stringify({ '/kantahe.v1.': { target: SERVER_URL, secure: false }, '/media': { target: SERVER_URL, secure: false } }));
    const appLog = join(work, 'ng.log');
    const web = spawn('npx', ['ng', 'serve', '--host', '127.0.0.1', '--port', String(APP_PORT), '--proxy-config', proxy], {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', openSync(appLog, 'a'), openSync(appLog, 'a')],
      detached: true,
    });
    children.push(web);
    await waitFor(`${APP_URL}/`, 'The web app', appLog, web, 240_000);
    // a first request through the proxy must reach the server
    const info = await fetch(`${APP_URL}/kantahe.v1.AuthService/GetServerInfo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!info.ok) throw new Error(`The proxy to the server does not work (${info.status}).`);
  } catch (e) {
    await teardown();
    throw e;
  }
  return teardown;
}
