import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthStore } from '../../core/auth.store';
import { TRANSPORT } from '../../core/api';
import { exportMsg, fakeAdminTransfer, gate, importMsg, infoMsg, inspectMsg } from '../testing';
import { TRANSFER_TIMING, TransferPage } from './transfer.page';

// giveUpMs is the page's own wall-clock budget for the server to come back: wide, so that a slow machine does not use it up; the test of giving up passes a small one
async function setup(timing = { pollMs: 1, giveUpMs: 10_000 }) {
  const server = fakeAdminTransfer();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }, { provide: TRANSFER_TIMING, useValue: timing }],
  });
  const auth = TestBed.inject(AuthStore);
  auth.setSession('token', 'device');
  const fixture = TestBed.createComponent(TransferPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ticks = 8) => {
    for (let i = 0; i < ticks; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  const type = async (id: string, value: string) => {
    const i = el.querySelector<HTMLInputElement>('#' + id)!;
    i.value = value;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(1);
  };
  const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
  const click = async (text: string, ticks = 8) => {
    const b = button(text);
    if (!b) throw new Error(`no button "${text}"`);
    b.click();
    await settle(ticks);
  };
  const tick = async (id: string) => {
    const c = el.querySelector<HTMLInputElement>('#' + id)!;
    c.checked = !c.checked;
    c.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(1);
  };
  const text = () => el.textContent!.replace(/\s+/g, ' ');
  // waits for what the page will show instead of guessing how long it takes: re-checks every 5 ms, up to `ms` (5 s)
  const until = async (done: () => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    for (;;) {
      await settle(1);
      if (done() || Date.now() > end) return;
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { server, auth, fixture, el, settle, type, button, click, tick, text, until };
}

describe('TransferPage', () => {
  describe('export', () => {
    it('sends the folder and shows how far it is, then where it wrote', async () => {
      const t = await setup();
      const hold = gate();
      t.server.handlers.export = async function* () {
        yield exportMsg({ filesDone: 3, filesTotal: 10, bytesDone: 1_048_576n, bytesTotal: 4_194_304n });
        await hold.promise;
        yield exportMsg({ filesDone: 10, filesTotal: 10, bytesDone: 4_194_304n, bytesTotal: 4_194_304n, done: true, folder: '/t/x' });
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      expect(t.server.calls.export.map((r) => r.folder)).toEqual(['/t/x']);
      const bar = t.el.querySelector('progress')!;
      expect([bar.value, bar.max]).toEqual([3, 10]);
      expect(bar.getAttribute('aria-label')).toBe('Export progress');
      const status = t.el.querySelector('[role=status]')!;
      expect(status.textContent).toContain('3 of 10 files');
      expect(status.textContent).toContain('1.0 of 4.0 MB');
      hold.open();
      await t.settle();
      expect(t.text()).toContain('Exported to /t/x.');
      expect(t.el.querySelector('progress')).toBeNull();
    });

    it('names the songs that were left out', async () => {
      const t = await setup();
      t.server.handlers.export = async function* () {
        yield exportMsg({ filesDone: 1, filesTotal: 1, done: true, folder: '/t/x', skippedNumbers: ['00012', '00031'] });
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      expect(t.text()).toContain('These songs were left out because their file could not be read: 00012, 00031');
    });

    it('shows the text the server sent for a folder it refuses', async () => {
      const t = await setup();
      // eslint-disable-next-line require-yield
      t.server.handlers.export = async function* () {
        throw new ConnectError('the folder /t/x is not empty: choose a new or empty folder', Code.InvalidArgument);
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      const alert = t.el.querySelector('[role=alert]')!;
      expect(alert.textContent).toContain('is not empty');
      expect(t.text()).not.toContain('Exported to');
      expect(t.button('Export')!.disabled).toBe(false);
    });

    it('says something general for a failure it knows nothing about', async () => {
      const t = await setup();
      // eslint-disable-next-line require-yield
      t.server.handlers.export = async function* () {
        throw new ConnectError('internal error', Code.Internal);
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      expect(t.el.querySelector('[role=alert]')!.textContent).toContain('Something went wrong');
    });

    it('asks for a folder before it calls the server', async () => {
      const t = await setup();
      await t.click('Export');
      expect(t.server.calls.export).toEqual([]);
      expect(t.el.querySelector('[role=alert]')!.textContent).toContain('folder');
    });

    it('Cancel aborts the call and says the folder is incomplete', async () => {
      const t = await setup();
      t.server.handlers.export = async function* (_req, signal) {
        yield exportMsg({ filesDone: 1, filesTotal: 10 });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
        throw new ConnectError('cancelled', Code.Canceled);
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      expect(t.button('Cancel')).toBeDefined();
      await t.click('Cancel');
      expect(t.server.signals.export[0].aborted).toBe(true);
      expect(t.text()).toContain('Export cancelled. The folder /t/x is incomplete; delete it.');
      expect(t.button('Cancel')).toBeUndefined();
    });

    it('leaving the page aborts a running export', async () => {
      const t = await setup();
      t.server.handlers.export = async function* (_req, signal) {
        yield exportMsg({ filesDone: 1, filesTotal: 10 });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
      };
      await t.type('export-folder', '/t/x');
      await t.click('Export');
      t.fixture.destroy();
      await new Promise((r) => setTimeout(r, 5));
      expect(t.server.signals.export[0].aborted).toBe(true);
    });
  });

  describe('import', () => {
    it('Check shows what the folder holds and the warning, or the reason it cannot be imported', async () => {
      const t = await setup();
      t.server.handlers.inspect = (req) => (req.folder === '/bad' ? inspectMsg({ importable: false, reason: 'no manifest here', songs: 0, users: 0, videos: 0 }) : inspectMsg());
      await t.type('import-folder', '/bad');
      await t.click('Check');
      expect(t.el.querySelector('[role=alert]')!.textContent).toContain('no manifest here');
      expect(t.button('Replace everything on this server')).toBeUndefined();

      await t.type('import-folder', '/good');
      await t.click('Check');
      expect(t.server.calls.inspect.map((r) => r.folder)).toEqual(['/bad', '/good']);
      const text = t.text();
      expect(text).toContain('From Old box (Kantahe 1.1.0), exported');
      expect(text).toContain('12 songs, 3 users, 1 videos, 5.0 MB');
      expect(text).toContain('Importing replaces everything on this server');
      expect(text).toContain('Everyone is signed out');
      expect(t.el.querySelector('[role=alert]')).toBeNull();
    });

    it('Replace is disabled until the box is ticked', async () => {
      const t = await setup();
      await t.type('import-folder', '/good');
      await t.click('Check');
      const replace = () => t.button('Replace everything on this server')!;
      expect(replace().disabled).toBe(true);
      await t.tick('import-confirm');
      expect(replace().disabled).toBe(false);
      await t.tick('import-confirm');
      expect(replace().disabled).toBe(true);
      expect(t.server.calls.import).toEqual([]);
    });

    it('editing the folder hides the summary and takes the tick back', async () => {
      const t = await setup();
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      expect(t.button('Replace everything on this server')).toBeDefined();
      await t.type('import-folder', '/good2');
      expect(t.button('Replace everything on this server')).toBeUndefined();
      expect(t.text()).not.toContain('From Old box');
      await t.click('Check');
      expect(t.button('Replace everything on this server')!.disabled).toBe(true);
    });

    it('waits for the restarted server, then signs out and points to the sign-in page', async () => {
      const t = await setup();
      const stage = gate();
      t.server.handlers.import = async function* () {
        yield importMsg({ filesDone: 1, filesTotal: 2, bytesDone: 1n, bytesTotal: 2n });
        await stage.promise;
        yield importMsg({ filesDone: 2, filesTotal: 2, bytesDone: 2n, bytesTotal: 2n, done: true, restarting: true });
      };
      // 1: the call before the import (the old start time); 2 and 3: still the old server or down; 4: down; then the new one
      t.server.handlers.info = (n) => {
        if (n === 1 || n === 2) return infoMsg(100n);
        if (n === 3 || n === 4) throw new ConnectError('unavailable', Code.Unavailable);
        return infoMsg(200n);
      };
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      await t.click('Replace everything on this server');
      expect(t.server.calls.import.map((r) => r.folder)).toEqual(['/good']);
      expect(t.el.querySelector('progress')?.getAttribute('aria-label')).toBe('Import progress');
      stage.open();
      await t.until(() => t.text().includes('The server is back.'));
      expect(t.text()).toContain('The server is back. Sign in with an account of the exported server.');
      expect(t.auth.token()).toBeUndefined();
      const link = Array.from(t.el.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/login');
      expect(link).toBeDefined();
      expect(t.server.calls.info).toBeGreaterThanOrEqual(5);
    });

    it('does not take the old server for the new one: the same start time is not "back"', async () => {
      const t = await setup({ pollMs: 1, giveUpMs: 80 });
      t.server.handlers.info = () => infoMsg(100n); // never restarts
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      await t.click('Replace everything on this server');
      await t.until(() => t.text().includes('The server has not come back yet.'));
      expect(t.text()).toContain('The server has not come back yet. Check its log.');
      expect(t.text()).not.toContain('The server is back');
      expect(t.auth.token()).toBe('token');
    });

    it('says to restart when the server cannot restart itself', async () => {
      const t = await setup();
      t.server.handlers.import = async function* () {
        yield importMsg({ filesDone: 2, filesTotal: 2, done: true, restarting: false });
      };
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      await t.click('Replace everything on this server');
      expect(t.text()).toContain('Imported. Restart the server to finish.');
      expect(t.server.calls.info).toBe(1); // only the call before the import
      expect(t.auth.token()).toBe('token');
    });

    it('shows the text the server sent when it refuses the import', async () => {
      const t = await setup();
      // eslint-disable-next-line require-yield
      t.server.handlers.import = async function* () {
        throw new ConnectError('the export has no enabled administrator', Code.InvalidArgument);
      };
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      await t.click('Replace everything on this server');
      expect(t.el.querySelector('[role=alert]')!.textContent).toContain('no enabled administrator');
      expect(t.text()).not.toContain('restarting');
      expect(t.auth.token()).toBe('token');
    });

    it('leaving the page does not stop a running import', async () => {
      const t = await setup();
      let ended = false;
      t.server.handlers.import = async function* (_req, signal) {
        yield importMsg({ filesDone: 1, filesTotal: 2 });
        await new Promise((r) => setTimeout(r, 20));
        ended = !signal.aborted;
        yield importMsg({ filesDone: 2, filesTotal: 2, done: true, restarting: false });
      };
      await t.type('import-folder', '/good');
      await t.click('Check');
      await t.tick('import-confirm');
      await t.click('Replace everything on this server');
      t.fixture.destroy();
      await new Promise((r) => setTimeout(r, 60));
      expect(ended).toBe(true); // the server was still not told to stop when the last message was sent
    });
  });

  it('allows one operation at a time: while an export runs, Check and Replace are off, and the other way round', async () => {
    const t = await setup();
    const hold = gate();
    t.server.handlers.export = async function* () {
      yield exportMsg({ filesDone: 1, filesTotal: 10 });
      await hold.promise;
      yield exportMsg({ done: true, folder: '/t/x' });
    };
    await t.type('import-folder', '/good');
    await t.click('Check');
    await t.tick('import-confirm');
    expect(t.button('Replace everything on this server')!.disabled).toBe(false);
    await t.type('export-folder', '/t/x');
    await t.click('Export');
    expect(t.button('Check')!.disabled).toBe(true);
    expect(t.button('Replace everything on this server')!.disabled).toBe(true);
    expect(t.el.querySelector<HTMLInputElement>('#import-folder')!.disabled).toBe(true);
    hold.open();
    await t.settle();
    expect(t.button('Check')!.disabled).toBe(false);

    const stage = gate();
    t.server.handlers.import = async function* () {
      yield importMsg({ filesDone: 1, filesTotal: 2 });
      await stage.promise;
      yield importMsg({ done: true, restarting: false });
    };
    await t.click('Replace everything on this server');
    expect(t.button('Export')!.disabled).toBe(true);
    expect(t.el.querySelector<HTMLInputElement>('#export-folder')!.disabled).toBe(true);
    stage.open();
    await t.settle();
  });

  it('has labelled fields, headings and real buttons', async () => {
    const t = await setup();
    expect(t.el.querySelector('label[for=export-folder]')!.textContent).toContain('Folder on the server');
    expect(t.el.querySelector('label[for=import-folder]')!.textContent).toContain('Folder on the server');
    expect(Array.from(t.el.querySelectorAll('h2, h3')).map((h) => h.textContent?.trim())).toEqual(['Move this server', 'Export', 'Import']);
    expect(t.text()).toContain('password hashes');
    await t.type('import-folder', '/good');
    await t.click('Check');
    expect(t.el.querySelector('label[for=import-confirm]')!.textContent).toContain('I understand that this replaces everything');
    for (const b of Array.from(t.el.querySelectorAll('button'))) expect(b.getAttribute('type')).toBe('button');
  });
});
