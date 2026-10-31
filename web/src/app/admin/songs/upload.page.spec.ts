import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { zipSync } from 'fflate';
import { AuthTokenSchema, UserSchema } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { fakeAdminSongs, UploadReply, UploadStatus } from '../testing';
import { UploadPage } from './upload.page';

const bytes = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
const file = (name: string, content = 'MThd data') => new File([bytes(content) as BlobPart], name);

async function setup(opts: { admin?: boolean; maxBytes?: number } = {}) {
  const server = fakeAdminSongs({ maxUploadBytes: opts.maxBytes ?? 1000 });
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: opts.admin ?? true, uploader: true }) }));
  const fixture = TestBed.createComponent(UploadPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (n = 4) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const pick = async (...files: File[]) => {
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };
  const rows = () => Array.from(el.querySelectorAll('tbody tr')).map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent?.trim()));
  const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  return { fixture, el, server, settle, pick, rows, button };
}

describe('UploadPage', () => {
  it('has a labelled file input for several .kar, .karmp3 and .zip files', async () => {
    const { el } = await setup();
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe('.kar,.karmp3,.zip');
    expect(el.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
  });

  it('three files are sent one after the other: the next only starts when the one before is answered', async () => {
    const { server, pick, settle } = await setup();
    const gates: (() => void)[] = [];
    server.handlers.upload = (_req, i) => new Promise<UploadReply>((resolve) => gates.push(() => resolve({ status: UploadStatus.ADDED, number: `0000${i + 1}` })));
    await pick(file('a.kar'), file('b.kar'), file('c.kar'));
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar']);
    gates[0]();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar', 'b.kar']);
    gates[1]();
    await settle();
    gates[2]();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar', 'b.kar', 'c.kar']);
    expect(server.concurrency.max).toBe(1);
  });

  it('sends the bytes of each file', async () => {
    const { server, pick } = await setup();
    await pick(file('a.kar', 'MThd hello'));
    expect(String.fromCharCode(...server.calls.upload[0].content)).toBe('MThd hello');
  });

  it('reports each file: Added with its number, Duplicate with its number, Rejected with the reason', async () => {
    const { server, pick, rows } = await setup();
    const answers: UploadReply[] = [
      { status: UploadStatus.ADDED, number: '01052' },
      { status: UploadStatus.DUPLICATE, number: '00007' },
      { status: UploadStatus.REJECTED, reason: 'this is not a karaoke file' },
    ];
    server.handlers.upload = (_r, i) => answers[i];
    await pick(file('a.kar'), file('b.kar'), file('c.kar'));
    expect(rows()).toEqual([
      ['a.kar', 'Added', '01052'],
      ['b.kar', 'Duplicate', '00007'],
      ['c.kar', 'Rejected', 'this is not a karaoke file'],
    ]);
  });

  it('shows progress as n of m and a summary at the end', async () => {
    const { server, pick, el } = await setup();
    server.handlers.upload = (_r, i) => (i === 1 ? { status: UploadStatus.REJECTED, reason: 'x' } : { status: UploadStatus.ADDED, number: `0000${i}` });
    await pick(file('a.kar'), file('b.kar'), file('c.kar'));
    expect(el.querySelector('[role="status"]')?.textContent).toContain('3 of 3');
    expect(el.textContent).toContain('2 added, 0 duplicates, 1 rejected');
  });

  it('a file larger than the limit is not sent and is reported as rejected', async () => {
    const { server, pick, rows } = await setup({ maxBytes: 1000 });
    await pick(file('small.kar', 'x'.repeat(100)), file('big.kar', 'x'.repeat(2000)));
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['small.kar']);
    expect(rows()[1][0]).toBe('big.kar');
    expect(rows()[1][1]).toBe('Rejected');
    expect(rows()[1][2]).toMatch(/larger than the limit/i);
  });

  it('an administrator is held to the limit the server has; anybody else to 50 MB', async () => {
    const admin = await setup({ admin: true, maxBytes: 1000 });
    expect(admin.server.calls.getSettings).toBe(1);
    TestBed.resetTestingModule();
    const uploader = await setup({ admin: false, maxBytes: 1000 });
    expect(uploader.server.calls.getSettings).toBe(0);
    await uploader.pick(file('big.kar', 'x'.repeat(2000)));
    expect(uploader.server.calls.upload.length).toBe(1); // 2000 bytes is nothing against 50 MB
  });

  it('Cancel stops after the file that is being sent', async () => {
    const { server, pick, settle, button, rows } = await setup();
    let release!: () => void;
    server.handlers.upload = (_r, i) => (i === 0 ? new Promise<UploadReply>((r) => (release = () => r({ status: UploadStatus.ADDED, number: '00001' }))) : { status: UploadStatus.ADDED, number: '0000x' });
    await pick(file('a.kar'), file('b.kar'), file('c.kar'));
    button('Cancel')!.click();
    release();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar']);
    expect(rows()).toEqual([
      ['a.kar', 'Added', '00001'],
      ['b.kar', 'Not sent', 'Cancelled'],
      ['c.kar', 'Not sent', 'Cancelled'],
    ]);
    expect(button('Cancel')).toBeUndefined();
  });

  it('a ZIP is unpacked: only its songs are sent, one by one', async () => {
    const { server, pick, rows } = await setup();
    const zip = new File([zipSync({ 'a/01 - x.kar': bytes('MThd one'), 'readme.txt': bytes('hi'), 'c.KARMP3': bytes('zip two') }) as BlobPart], 'pack.zip');
    await pick(zip);
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['01 - x.kar', 'c.KARMP3']);
    expect(rows().map((r) => r[0])).toEqual(['pack.zip: 01 - x.kar', 'pack.zip: c.KARMP3']);
    expect(server.concurrency.max).toBe(1);
  });

  it('regression: a song in a ZIP that is above the limit is reported, not unpacked into memory', async () => {
    const { server, pick, rows } = await setup({ maxBytes: 1000 });
    const big = Uint8Array.from({ length: 200_000 }, () => 97);
    await pick(new File([zipSync({ 'huge.kar': big, 'ok.kar': bytes('MThd fine') }) as BlobPart], 'pack.zip'));
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['ok.kar']);
    expect(rows()[0].slice(0, 2)).toEqual(['pack.zip: huge.kar', 'Rejected']);
    expect(rows()[0][2]).toMatch(/larger than the limit/i);
  });

  it('regression: Cancel in the middle of a ZIP says that the rest of it was not sent', async () => {
    const { server, pick, settle, button, rows } = await setup();
    let release!: () => void;
    server.handlers.upload = (_r, i) => (i === 0 ? new Promise<UploadReply>((r) => (release = () => r({ status: UploadStatus.ADDED, number: '00001' }))) : { status: UploadStatus.ADDED, number: '0000x' });
    await pick(new File([zipSync({ 'a.kar': bytes('MThd a'), 'b.kar': bytes('MThd b'), 'c.kar': bytes('MThd c') }) as BlobPart], 'pack.zip'));
    button('Cancel')!.click();
    release();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar']);
    expect(rows()).toEqual([
      ['pack.zip: a.kar', 'Added', '00001'],
      ['pack.zip', 'Not sent', 'Cancelled'],
    ]);
  });

  it('regression: leaving the page stops the upload (nothing goes on in the background)', async () => {
    const { server, pick, settle, fixture } = await setup();
    let release!: () => void;
    server.handlers.upload = (_r, i) => (i === 0 ? new Promise<UploadReply>((r) => (release = () => r({ status: UploadStatus.ADDED, number: '1' }))) : { status: UploadStatus.ADDED, number: '2' });
    await pick(file('a.kar'), file('b.kar'), file('c.kar'));
    fixture.destroy();
    release();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar']);
  });

  it('a ZIP without songs says so', async () => {
    const { pick, rows } = await setup();
    await pick(new File([zipSync({ 'readme.txt': bytes('hi') }) as BlobPart], 'nothing.zip'));
    expect(rows()).toEqual([['nothing.zip', 'Rejected', 'No songs found in this ZIP file.']]);
  });

  it('a ZIP that cannot be read is reported and the next file still goes', async () => {
    const { server, pick, rows } = await setup();
    const good = zipSync({ 'a.kar': Uint8Array.from(Array.from('some words to sing '.repeat(200), (c) => c.charCodeAt(0))) });
    const cut = new File([good.slice(0, Math.floor(good.length / 2)) as BlobPart], 'cut.zip');
    await pick(cut, file('after.kar'));
    expect(rows()[0][0]).toBe('cut.zip');
    expect(rows()[0][1]).toBe('Rejected');
    expect(rows()[0][2]).toMatch(/could not be read/i);
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['after.kar']);
  });

  it('other kinds of file are not sent', async () => {
    const { server, pick, rows } = await setup();
    await pick(file('notes.txt'), file('song.MID'));
    expect(server.calls.upload).toEqual([]);
    expect(rows().map((r) => [r[1], r[2]])).toEqual([
      ['Rejected', 'Only .kar, .karmp3 and .zip files can be uploaded.'],
      ['Rejected', 'Only .kar, .karmp3 and .zip files can be uploaded.'],
    ]);
  });

  it('a failed call is reported with the reason and the next file goes on', async () => {
    const { server, pick, rows } = await setup();
    server.failNext(new ConnectError('upload permission required', Code.PermissionDenied));
    await pick(file('a.kar'), file('b.kar'));
    expect(rows()[0].slice(0, 2)).toEqual(['a.kar', 'Rejected']);
    expect(rows()[0][2]).toContain('upload permission required');
    expect(rows()[1].slice(0, 2)).toEqual(['b.kar', 'Added']);
  });

  it('files dropped on the page are uploaded too', async () => {
    const { el, server, settle } = await setup();
    const drop = Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: { files: [file('dropped.kar')] } });
    el.querySelector('.drop')!.dispatchEvent(drop);
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['dropped.kar']);
    expect(drop.defaultPrevented).toBe(true);
  });

  it('dragging over the page allows the drop', async () => {
    const { el } = await setup();
    const over = new Event('dragover', { bubbles: true, cancelable: true });
    el.querySelector('.drop')!.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
  });

  it('a new selection while files are still going is ignored', async () => {
    const { server, pick, settle } = await setup();
    let release!: () => void;
    server.handlers.upload = (_r, i) => (i === 0 ? new Promise<UploadReply>((r) => (release = () => r({ status: UploadStatus.ADDED, number: '1' }))) : { status: UploadStatus.ADDED, number: '2' });
    await pick(file('a.kar'));
    await pick(file('b.kar'));
    release();
    await settle();
    expect(server.calls.upload.map((c) => c.filename)).toEqual(['a.kar']);
  });

  it('the next selection starts a fresh report', async () => {
    const { pick, rows } = await setup();
    await pick(file('a.kar'));
    await pick(file('b.kar'));
    expect(rows().map((r) => r[0])).toEqual(['b.kar']);
  });
});
