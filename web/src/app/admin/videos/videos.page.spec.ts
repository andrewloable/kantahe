import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { TRANSPORT } from '../../core/api';
import { ToastService } from '../../core/toast';
import { bigFile, fakeVideoServer, listed, MIB } from './testing';
import { VideosPage } from './videos.page';

const three = () => [listed('v1', 'Beach'), listed('v2', 'Sunset', { hasAudio: true, warnings: ['not optimised for streaming (moov after mdat)'] }), listed('v3', 'City', { enabled: false, width: 2560, height: 1440 })];

async function setup(opts: Parameters<typeof fakeVideoServer>[0] = { videos: three() }) {
  const server = fakeVideoServer(opts);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }, provideRouter([])] });
  localStorage.clear();
  const fixture = TestBed.createComponent(VideosPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('li.video'));
  const row = (name: string) => rows().find((r) => r.querySelector('.name')?.textContent?.trim() === name)!;
  /** By id: while a name is being changed its row has an input where the name was. */
  const rowOf = (id: string) => rows().find((r) => r.getAttribute('data-video') === id)!;
  const button = (within: ParentNode, label: string) => within.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`)!;
  const click = async (b: HTMLElement) => {
    b.click();
    await settle();
  };
  /** The file input with these files chosen. */
  const choose = async (...files: File[]) => {
    const input = el.querySelector<HTMLInputElement>('#video-files')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };
  const uploadTexts = () => Array.from(el.querySelectorAll('.uploads li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
  return { fixture, el, server, settle, rows, row, rowOf, button, click, choose, uploadTexts };
}

describe('VideosPage', () => {
  afterEach(() => TestBed.inject(ToastService).toasts.set([]));

  it('lists the videos in loop order with their number, picture facts, notes and warnings', async () => {
    const { rows, row } = await setup();
    expect(rows().map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Beach', 'Sunset', 'City']);
    expect(rows().map((r) => r.querySelector('.pos')?.textContent?.trim())).toEqual(['1.', '2.', '3.']);
    expect(row('Beach').querySelector('.facts')?.textContent).toBe('1920 x 1080 · 0:30 · 42 MB · H.264');
    expect(row('City').querySelector('.facts')?.textContent).toContain('2560 x 1440');
    expect(row('Sunset').querySelector('[role="note"]')?.textContent).toContain('not optimised for streaming');
    expect(row('Sunset').querySelector('.sound')?.textContent).toBe('has a sound track (never played)');
    expect(row('Beach').querySelector('.sound'), 'only a file with a sound track says so').toBeNull();
    expect(row('Sunset').querySelector('.sound')?.getAttribute('role'), 'a neutral note, not a warning').toBeNull();
  });

  it('says so when there are no videos', async () => {
    const { el } = await setup({ videos: [] });
    expect(el.textContent).toContain('No background videos yet. Choose files above.');
  });

  it('VIDEO ONLY: the preview is muted, at volume 0 and has no controls that could give it sound', async () => {
    const { rows, click, button, row } = await setup();
    for (const r of rows()) {
      const v = r.querySelector('video')!;
      expect(v.muted).toBe(true);
      expect(v.volume).toBe(0);
      expect(v.hasAttribute('controls')).toBe(false);
      expect(v.getAttribute('src')).toContain('#t=0.1');
    }
    // something turns the sound on: it is put right again
    const v = row('Beach').querySelector('video')!;
    v.muted = false;
    v.volume = 1;
    v.dispatchEvent(new Event('volumechange'));
    expect(v.muted).toBe(true);
    expect(v.volume).toBe(0);
    // the preview button plays it, still without sound
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    await click(button(row('Beach'), 'Play the preview of Beach'));
    expect(v.muted).toBe(true);
    expect(button(row('Beach'), 'Stop the preview of Beach')).not.toBeNull();
  });

  describe('adding', () => {
    it('a file that is not an .mp4, .m4v or .mov is refused on the page and nothing is sent', async () => {
      const { server, choose, uploadTexts } = await setup();
      await choose(bigFile('film.avi', 5 * MIB));
      expect(uploadTexts()[0]).toContain('film.avi');
      expect(uploadTexts()[0]).toContain('Refused: only .mp4, .m4v and .mov files');
      expect(server.calls.begin).toEqual([]);
    });

    it('a file larger than the limit is refused with the limit', async () => {
      const { server, choose, uploadTexts } = await setup({ videos: [], maxVideoBytes: 500 * MIB });
      await choose(bigFile('big.mp4', 501 * MIB));
      expect(uploadTexts()[0]).toContain('Refused: larger than the limit of 500 MB');
      expect(server.calls.begin).toEqual([]);
    });

    it('an empty file is refused', async () => {
      const { choose, uploadTexts } = await setup();
      await choose(bigFile('empty.mp4', 0));
      expect(uploadTexts()[0]).toContain('Refused: the file is empty');
    });

    it('two good files go up in order, one at a time: the second starts only when the first has ended', async () => {
      const { server, choose, settle, uploadTexts } = await setup({ videos: [] });
      let release!: () => void;
      server.hold.promise = new Promise<void>((resolve) => (release = resolve));
      await choose(bigFile('one.mp4', 5 * MIB), bigFile('two.mp4', 5 * MIB));
      expect(server.calls.begin.map((b) => b.filename), 'only the first has begun').toEqual(['one.mp4']);
      expect(uploadTexts()[0]).toMatch(/one\.mp4.*(Starting|Uploading)/);
      expect(uploadTexts()[1]).toContain('Waiting');
      server.hold.promise = undefined;
      release();
      await vi.waitFor(() => expect(server.calls.begin.map((b) => b.filename)).toEqual(['one.mp4', 'two.mp4']));
      await vi.waitFor(() => expect(server.calls.complete).toHaveLength(2));
      await settle();
      expect(uploadTexts()[0]).toContain('Added');
      expect(uploadTexts()[1]).toContain('Added');
      expect(server.calls.chunks.map((c) => c.size)).toEqual([4 * MIB, 1 * MIB, 4 * MIB, 1 * MIB]);
    });

    it('a video that is added shows in the list (the list is asked for again)', async () => {
      const { server, choose, rows } = await setup({ videos: [] });
      await choose(bigFile('beach.mp4', 5 * MIB));
      await vi.waitFor(() => expect(rows()).toHaveLength(1));
      expect(server.calls.list).toBeGreaterThanOrEqual(2);
    });

    it('a duplicate says "Already in the list"', async () => {
      const { choose, uploadTexts, settle } = await setup({ videos: [], script: { complete: { status: UploadStatus.DUPLICATE, video: listed('v1', 'Beach') } } });
      await choose(bigFile('beach.mp4', 5 * MIB));
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Already in the list'));
      await settle();
    });

    it('the reason the server gives for a refusal is shown', async () => {
      const { choose, uploadTexts } = await setup({ videos: [], script: { complete: { status: UploadStatus.REJECTED, reason: 'the video codec hvc1 is not supported: re-encode it as H.264' } } });
      await choose(bigFile('a.mp4', 5 * MIB));
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Refused: the video codec hvc1 is not supported'));
    });

    it('an upload that was resumed says where it went on, and has a progress element named after the file while it runs', async () => {
      const { server, el, choose, uploadTexts } = await setup({ videos: [], script: { received: 4 * MIB } });
      let release!: () => void;
      server.hold.promise = new Promise<void>((resolve) => (release = resolve));
      await choose(bigFile('beach.mp4', 10 * MIB));
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Resuming at 40%'));
      expect(el.querySelector('progress')?.getAttribute('aria-label')).toBe('Uploading beach.mp4');
      server.hold.promise = undefined;
      release();
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Added'));
    });

    it('Cancel stops the file that is being sent and throws it away on the server', async () => {
      const { server, choose, button, el, uploadTexts, settle } = await setup({ videos: [], script: { hangAt: [1] } });
      await choose(bigFile('beach.mp4', 10 * MIB));
      await vi.waitFor(() => expect(server.calls.chunks).toHaveLength(1));
      button(el, 'Cancel the upload of beach.mp4').click();
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Cancelled'));
      await settle();
      expect(server.calls.abort).toEqual(['up1']);
      expect(server.calls.complete).toEqual([]);
    });

    it('Cancel on a file that is still waiting only takes it out of the queue', async () => {
      const { server, choose, button, el, uploadTexts } = await setup({ videos: [], script: { hangAt: [1] } });
      await choose(bigFile('one.mp4', 10 * MIB), bigFile('two.mp4', 10 * MIB));
      await vi.waitFor(() => expect(server.calls.chunks).toHaveLength(1));
      button(el, 'Cancel the upload of two.mp4').click();
      await vi.waitFor(() => expect(uploadTexts()[1]).toContain('Cancelled'));
      expect(server.calls.begin.map((b) => b.filename)).toEqual(['one.mp4']);
      button(el, 'Cancel the upload of one.mp4').click();
      await vi.waitFor(() => expect(uploadTexts()[0]).toContain('Cancelled'));
      expect(server.calls.begin, 'the cancelled one never starts').toHaveLength(1);
    });
  });

  describe('the list', () => {
    it('Move up on row 2 sends the new order of all ids; the ends cannot move out', async () => {
      const { server, row, button, click, rows } = await setup();
      expect(button(row('Beach'), 'Move Beach up').disabled).toBe(true);
      expect(button(row('City'), 'Move City down').disabled).toBe(true);
      expect(button(row('Beach'), 'Move Beach down').disabled).toBe(false);
      await click(button(row('Sunset'), 'Move Sunset up'));
      expect(server.calls.reorder).toEqual([['v2', 'v1', 'v3']]);
      expect(rows().map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Sunset', 'Beach', 'City']);
    });

    it('Move down sends the new order too', async () => {
      const { server, row, button, click } = await setup();
      await click(button(row('Beach'), 'Move Beach down'));
      expect(server.calls.reorder).toEqual([['v2', 'v1', 'v3']]);
    });

    it('a reorder the server refuses (the list changed) reloads the list and says so', async () => {
      const { server, row, button, click } = await setup();
      server.fail.reorder = new ConnectError('the list does not match the videos on the server: reload', Code.InvalidArgument);
      const listings = server.calls.list;
      await click(button(row('Sunset'), 'Move Sunset up'));
      expect(server.calls.list).toBe(listings + 1);
      expect(TestBed.inject(ToastService).toasts()[0].message).toContain('The videos changed on the server');
    });

    it('Rename saves a trimmed name; Enter saves and Escape cancels', async () => {
      const { server, row, rowOf, button, click, settle, el } = await setup();
      await click(button(row('Beach'), 'Rename Beach'));
      const input = () => el.querySelector<HTMLInputElement>('#name-v1')!;
      input().value = '  Beach at night  ';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      await click(button(rowOf('v1'), 'Save the name of Beach'));
      expect(server.calls.update).toEqual([expect.objectContaining({ id: 'v1', name: '  Beach at night  ' })]);
      expect(row('Beach at night')).toBeDefined();
      expect(el.querySelector('#name-v1')).toBeNull();
      // Enter saves
      await click(button(row('Beach at night'), 'Rename Beach at night'));
      input().value = 'Dawn';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
      expect(row('Dawn')).toBeDefined();
      // Escape cancels
      await click(button(row('Dawn'), 'Rename Dawn'));
      input().value = 'Nope';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(el.querySelector('#name-v1')).toBeNull();
      expect(row('Dawn')).toBeDefined();
      expect(server.calls.update).toHaveLength(2);
    });

    it('an empty name is refused with the message of the server and the input stays', async () => {
      const { row, rowOf, button, click, el } = await setup();
      await click(button(row('Beach'), 'Rename Beach'));
      const input = el.querySelector<HTMLInputElement>('#name-v1')!;
      input.value = '   ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await click(button(rowOf('v1'), 'Save the name of Beach'));
      expect(el.querySelector('li.video [role="alert"]')?.textContent).toContain('the name must be 1 to 200 characters');
      expect(el.querySelector('#name-v1')).not.toBeNull();
    });

    it('the checkbox "Play this video" calls UpdateVideo with only the flag', async () => {
      const { server, row, el, settle } = await setup();
      const box = row('City').querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(box.checked).toBe(false);
      expect(box.getAttribute('aria-label')).toBe('Play City in the loop');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.update).toEqual([expect.objectContaining({ id: 'v3', enabled: true })]);
      expect(server.calls.update[0].name).toBeUndefined();
      expect(el.querySelector<HTMLInputElement>('li.video:nth-child(3) input[type="checkbox"]')!.checked).toBe(true);
    });

    it('Delete asks first; Cancel sends nothing', async () => {
      const { server, row, button, click } = await setup();
      await click(button(row('Beach'), 'Delete Beach'));
      expect(row('Beach').querySelector('[role="alert"]')?.textContent).toContain('Delete "Beach" and its file? Players stop showing it.');
      expect(server.calls.remove).toEqual([]);
      await click(button(row('Beach'), 'Keep Beach'));
      expect(server.calls.remove).toEqual([]);
      expect(row('Beach').querySelector('[role="alert"]')).toBeNull();
    });

    it('confirming sends DeleteVideo and the row goes; the others move up', async () => {
      const { server, row, button, click, rows } = await setup();
      await click(button(row('Sunset'), 'Delete Sunset'));
      await click(button(row('Sunset'), 'Delete Sunset for good'));
      expect(server.calls.remove).toEqual(['v2']);
      expect(rows().map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Beach', 'City']);
      expect(rows().map((r) => r.querySelector('.pos')?.textContent?.trim())).toEqual(['1.', '2.']);
    });

    it('a delete the server cannot do (the file is in use) is said, and the video stays', async () => {
      const { server, row, button, click, rows } = await setup();
      server.fail.next = new ConnectError("the video's file could not be deleted: it is in use", Code.FailedPrecondition);
      await click(button(row('Beach'), 'Delete Beach'));
      await click(button(row('Beach'), 'Delete Beach for good'));
      expect(TestBed.inject(ToastService).toasts()[0].message).toContain("the video's file could not be deleted");
      expect(rows()).toHaveLength(3);
    });
  });

  describe('the options', () => {
    it('toggling each checkbox sends exactly one UpdateServerSettings with only that field', async () => {
      const { server, el, settle } = await setup();
      const [enabled, shuffle] = Array.from(el.querySelectorAll<HTMLInputElement>('.options input[type="checkbox"]'));
      expect(enabled.checked).toBe(true);
      expect(shuffle.checked).toBe(false);
      shuffle.checked = true;
      shuffle.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.settings).toHaveLength(1);
      expect(server.calls.settings[0].backgroundShuffle).toBe(true);
      expect(server.calls.settings[0].backgroundEnabled).toBeUndefined();
      expect(server.calls.settings[0].maxUploadBytes).toBeUndefined();
      expect(server.calls.settings[0].scoreSeconds).toBeUndefined();
      expect(server.calls.settings[0].maxVideoBytes).toBeUndefined();
      enabled.checked = false;
      enabled.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.settings).toHaveLength(2);
      expect(server.calls.settings[1].backgroundEnabled).toBe(false);
      expect(server.calls.settings[1].backgroundShuffle).toBeUndefined();
      expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toContain('Saved.');
    });

    it('a refused change puts the checkbox back and says why', async () => {
      const { server, el, settle } = await setup();
      const shuffle = el.querySelectorAll<HTMLInputElement>('.options input[type="checkbox"]')[1];
      server.fail.next = new ConnectError('down', Code.Unavailable);
      shuffle.checked = true;
      shuffle.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(shuffle.checked).toBe(false);
      expect(TestBed.inject(ToastService).toasts()[0].kind).toBe('error');
    });

    it('points to My devices for the per-device choice', async () => {
      const { el } = await setup();
      expect(el.querySelector('a[href="/me/devices"]')?.textContent).toContain('My devices');
    });
  });

  describe('loading', () => {
    it('a failed load shows an inline error with Try again', async () => {
      const server = fakeVideoServer({ videos: three() });
      server.fail.list = new ConnectError('down', Code.Unavailable);
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }, provideRouter([])] });
      const fixture = TestBed.createComponent(VideosPage);
      const el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not reach the server');
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Try again') as HTMLButtonElement).click();
      for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      expect(el.querySelectorAll('li.video')).toHaveLength(3);
    });
  });

  // A keyboard user must not be thrown back to the top of the page by an action: where the control they used has gone, focus follows it.
  describe('keyboard focus', () => {
    const label = () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.id ?? document.activeElement?.tagName;

    it('Rename puts the cursor in the name field; Save, Cancel and Escape go back to the Rename button', async () => {
      const { row, rowOf, button, click, settle, el } = await setup();
      await click(button(row('Beach'), 'Rename Beach'));
      expect(label()).toBe('name-v1');
      await click(button(rowOf('v1'), 'Cancel renaming Beach'));
      expect(label()).toBe('Rename Beach');
      await click(button(row('Beach'), 'Rename Beach'));
      el.querySelector<HTMLInputElement>('#name-v1')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(label()).toBe('Rename Beach');
      await click(button(row('Beach'), 'Rename Beach'));
      await click(button(rowOf('v1'), 'Save the name of Beach'));
      expect(label()).toBe('Rename Beach');
    });

    it('a move keeps focus on the same button of the same video, wherever that video went', async () => {
      const { row, button, click } = await setup();
      button(row('Beach'), 'Move Beach down').focus();
      await click(button(row('Beach'), 'Move Beach down')); // Beach is second now: both directions work, and the one just used keeps the focus
      expect(label()).toBe('Move Beach down');
      await click(button(row('Beach'), 'Move Beach down')); // and last: it cannot go further down
      expect(label()).toBe('Move Beach up');
    });

    it('a move to the end leaves focus on the button that still works', async () => {
      const { row, button, click } = await setup();
      await click(button(row('Sunset'), 'Move Sunset down')); // Sunset is last now
      expect(label()).toBe('Move Sunset up');
    });

    it('Delete moves focus into the question, onto Cancel; Cancel gives it back to Delete; confirming lands on the heading of the list', async () => {
      const { row, button, click } = await setup();
      await click(button(row('Beach'), 'Delete Beach'));
      expect(label()).toBe('Keep Beach');
      await click(button(row('Beach'), 'Keep Beach'));
      expect(label()).toBe('Delete Beach');
      await click(button(row('Beach'), 'Delete Beach'));
      await click(button(row('Beach'), 'Delete Beach for good'));
      expect(document.activeElement?.id).toBe('the-videos');
    });

    it('a delete that fails gives focus back to the Delete button', async () => {
      const { server, row, button, click } = await setup();
      server.fail.next = new ConnectError('in use', Code.FailedPrecondition);
      await click(button(row('Beach'), 'Delete Beach'));
      await click(button(row('Beach'), 'Delete Beach for good'));
      expect(label()).toBe('Delete Beach');
    });

    it('Cancel on an upload puts focus on the file chooser, as the Cancel button is gone', async () => {
      const { server, choose, button, el } = await setup({ videos: [], script: { hangAt: [1] } });
      await choose(bigFile('beach.mp4', 10 * MIB));
      await vi.waitFor(() => expect(server.calls.chunks).toHaveLength(1));
      button(el, 'Cancel the upload of beach.mp4').click();
      await vi.waitFor(() => expect(document.activeElement?.id).toBe('video-files'));
    });
  });

  describe('accessibility and layout', () => {
    it('every button of a video has an accessible name that contains the name of the video, and every field a label', async () => {
      const { rows, el, click, button, row } = await setup();
      await click(button(row('Beach'), 'Delete Beach')); // the question too
      await click(button(row('Sunset'), 'Rename Sunset')); // the rename form too
      const names: Record<string, string> = { v1: 'Beach', v2: 'Sunset', v3: 'City' };
      for (const r of rows()) {
        const name = names[r.getAttribute('data-video')!];
        for (const b of Array.from(r.querySelectorAll('button'))) expect(b.getAttribute('aria-label') ?? b.textContent, b.outerHTML).toContain(name);
      }
      for (const input of Array.from(el.querySelectorAll('input'))) {
        const labelled = input.getAttribute('aria-label') || el.querySelector(`label[for="${input.id}"]`) || input.closest('label');
        expect(labelled, input.outerHTML).toBeTruthy();
      }
    });

    it('the groups of controls are rows that wrap with room between them, and the list items too', async () => {
      await setup();
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      for (const group of ['actions', 'title', 'confirm', 'rename']) {
        expect(css, group).toMatch(new RegExp(`\\.${group}[^{]*\\{[^}]*display:\\s*flex`));
      }
      expect(css).toMatch(/\.actions[^{]*\{[^}]*flex-wrap:\s*wrap/);
      expect(css).toMatch(/\.actions[^{]*\{[^}]*gap:\s*[0-9.]+rem/);
      expect(css).toMatch(/\.video[^{]*\{[^}]*flex-wrap:\s*wrap/);
      expect(css).toMatch(/\.video[^{]*\{[^}]*gap:\s*[0-9.]+rem/);
    });

    it('regression: the link to My devices is a target of its own, 44 px high, not a link inside a sentence (the audit found it too small)', async () => {
      const { el } = await setup();
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      const link = el.querySelector('a[href="/me/devices"]')!;
      expect(link.classList.contains('devices-link')).toBe(true);
      expect(link.closest('p'), 'not inside a paragraph of running text').toBeNull();
      expect(css).toMatch(/\.devices-link[^{]*\{[^}]*min-height:\s*2\.75rem/);
    });

    it('has the headings Background videos (h2) with a section each for adding, the videos and the options', async () => {
      const { el } = await setup();
      expect(el.querySelectorAll('h2')).toHaveLength(1);
      expect(el.querySelector('h2')?.textContent).toBe('Background videos');
      expect(Array.from(el.querySelectorAll('h3')).map((h) => h.textContent)).toEqual(['Add videos', 'The videos', 'Options']);
      expect(el.querySelector('label[for="video-files"]')?.textContent).toBe('Choose video files');
      expect(el.querySelector('#video-files')?.getAttribute('accept')).toBe('.mp4,.m4v,.mov,video/mp4');
      expect(el.querySelector('#video-files')?.hasAttribute('multiple')).toBe(true);
    });
  });
});
