import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../../core/api';
import { fakeAdminSongs } from '../testing';
import { ServerSettingsPage } from './server-settings.page';

async function setup() {
  const server = fakeAdminSongs({ maxUploadBytes: 50 * 1024 * 1024, scoreSeconds: 6 });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(ServerSettingsPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const type = (id: string, value: string) => {
    const i = el.querySelector<HTMLInputElement>('#' + id)!;
    i.value = value;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const save = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };
  return { fixture, el, server, settle, type, save };
}

describe('ServerSettingsPage', () => {
  it('shows the upload limit in megabytes and the score time in seconds', async () => {
    const { el } = await setup();
    expect(el.querySelector<HTMLInputElement>('#max-upload')!.value).toBe('50');
    expect(el.querySelector<HTMLInputElement>('#score-seconds')!.value).toBe('6');
    for (const input of Array.from(el.querySelectorAll('input'))) expect(el.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
  });

  it('saves only what changed: the upload limit in bytes', async () => {
    const { type, save, server, el } = await setup();
    type('max-upload', '100');
    await save();
    expect(server.calls.settings.length).toBe(1);
    expect(server.calls.settings[0].maxUploadBytes).toBe(BigInt(100 * 1024 * 1024));
    expect(server.calls.settings[0].scoreSeconds).toBeUndefined();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Saved');
  });

  it('saves only the score time when only that changed', async () => {
    const { type, save, server } = await setup();
    type('score-seconds', '10');
    await save();
    expect(server.calls.settings[0].scoreSeconds).toBe(10);
    expect(server.calls.settings[0].maxUploadBytes).toBeUndefined();
  });

  it('allows 0 to 60 seconds', async () => {
    const { type, save, server, el } = await setup();
    for (const bad of ['-1', '61', '2.5', '']) {
      type('score-seconds', bad);
      await save();
      expect(el.querySelector('[role="alert"]')?.textContent, bad).toContain('0 to 60');
    }
    expect(server.calls.settings).toEqual([]);
    type('score-seconds', '0');
    await save();
    expect(server.calls.settings[0].scoreSeconds).toBe(0);
    type('score-seconds', '60');
    await save();
    expect(server.calls.settings[1].scoreSeconds).toBe(60);
  });

  it('the upload limit must be a whole number of at least 1 MB', async () => {
    const { type, save, server, el } = await setup();
    for (const bad of ['0', '-5', '1.5', 'abc', '']) {
      type('max-upload', bad);
      await save();
      expect(el.querySelector('[role="alert"]')?.textContent, bad).toContain('whole number of megabytes');
    }
    expect(server.calls.settings).toEqual([]);
  });

  it('nothing changed, nothing sent', async () => {
    const { save, server } = await setup();
    await save();
    expect(server.calls.settings).toEqual([]);
  });

  it('shows what the server says when it refuses', async () => {
    const { type, save, server, el } = await setup();
    server.failNext(new ConnectError('upload limit is too large', Code.InvalidArgument));
    type('max-upload', '999999');
    await save();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('upload limit is too large');
  });

  it('shows the values the server answered with', async () => {
    const { type, save, el } = await setup();
    type('score-seconds', '12');
    await save();
    expect(el.querySelector<HTMLInputElement>('#score-seconds')!.value).toBe('12');
  });
});
