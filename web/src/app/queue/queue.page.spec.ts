import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema, LyricTiming } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { ToastsComponent } from '../core/toasts.component';
import { QueuePage } from './queue.page';
import { device, fakeSession, Format, PlayStatus, song, stateOf, StateInit } from './testing';

const BASE: StateInit = {
  status: PlayStatus.PAUSED,
  player: 'me',
  devices: [device('me', 'Phone', { isCaller: true })],
  queue: [
    { id: 'q1', song: song('01052', 'Hello', 'Adele', Format.MP3, false, { lyricTiming: LyricTiming.WORD, hasVocals: true }) },
    { id: 'q2', song: song('21628', 'Skyfall', 'Adele', Format.MIDI) },
    { id: 'q3', song: song('3', 'Third', 'X') },
  ],
};

async function setup(initial?: StateInit) {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'me' }));
  TestBed.tick();
  if (initial) server.push(stateOf(initial));
  const fixture = TestBed.createComponent(QueuePage);
  const toastsFixture = TestBed.createComponent(ToastsComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 10) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
    toastsFixture.detectChanges();
  };
  await settle();
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('.queue li'));
  // a row's actions are in its More menu (kantahe-du1.7): open it when the action is not on screen yet
  const find = (row: HTMLElement, name: string) => Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(name));
  const menu = (row: HTMLElement) => {
    row.querySelector<HTMLButtonElement>('button.more')!.click();
    fixture.detectChanges();
    return Array.from(row.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  };
  const click = (row: HTMLElement, name: string) => {
    if (!find(row, name)) menu(row);
    find(row, name)!.click();
    fixture.detectChanges();
  };
  return { fixture, el, server, settle, rows, click, menu, toastEl: toastsFixture.nativeElement as HTMLElement, toasts: TestBed.inject(ToastService) };
}

describe('QueuePage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('lists the queue in order with number, title, artist and badge', async () => {
    const { rows } = await setup(BASE);
    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Hello');
    expect(rows()[0].textContent).toContain('MP3');
    expect(rows()[0].querySelector('.timing-badge')?.textContent).toBe('W');
    expect(rows()[0].querySelector('.vocals-badge')?.textContent).toBe('V');
    expect(rows()[1].querySelector('.timing-badge')).toBeNull();
    expect(rows()[1].textContent).toContain('Skyfall');
    expect(rows()[1].textContent).toContain('MIDI');
    expect(rows()[2].textContent).toContain('Third');
  });

  // kantahe-cqc.7: each row shows its place and, roughly, when it starts
  it('regression: rows show their position, next for the first while a song is on, and about when the others start', async () => {
    const { rows } = await setup({
      ...BASE,
      // paused: the position stays at 50 s while the test runs
      now: { song: Object.assign(song('9', 'Now', 'X', Format.MP3), { durationMs: 200_000n }), positionMs: 50_000, positionAtMs: 1000 },
      queue: [
        { id: 'q1', song: Object.assign(song('1', 'One', 'A', Format.MP3), { durationMs: 180_000n }) },
        { id: 'q2', song: Object.assign(song('2', 'Two', 'B', Format.MP3), { durationMs: 240_000n }) },
      ],
    });
    expect(rows()[0].querySelector('.pos')?.textContent).toContain('1');
    expect(rows()[0].querySelector('.pos')?.textContent).toContain('next');
    expect(rows()[1].querySelector('.pos')?.textContent).toContain('2');
    // 150 s left of the current song + 10 s, then 180 s + 10 s: 350 s, about 6 minutes
    expect(rows()[1].querySelector('.pos')?.textContent).toContain('starts in about 6 minutes');
  });

  it('says so when the queue is empty', async () => {
    const { el } = await setup({ ...BASE, queue: [] });
    expect(el.textContent).toContain('The queue is empty');
    const link = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.trim() === 'Open the Library');
    expect(link?.getAttribute('href'), 'it says how to fill the queue and links to the Library').toBe('/library');
  });

  it('regression: after a few seconds without a state it says that the server cannot be reached, and the state replaces that message', async () => {
    const { el, server, settle } = await setup();
    await settle(7000);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not reach the server');
    server.push(stateOf(BASE));
    await settle();
    expect(el.textContent).not.toContain('Could not reach the server');
    expect(el.querySelectorAll('.queue li').length).toBe(3);
  });

  it('shows that it is connecting until the first state arrives', async () => {
    const { el, server, settle } = await setup();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Connecting');
    server.push(stateOf(BASE));
    await settle();
    expect(el.textContent).not.toContain('Connecting');
    expect(el.querySelectorAll('.queue li').length).toBe(3);
  });

  it('follows every new state from the server', async () => {
    const { rows, server, settle } = await setup(BASE);
    server.push(stateOf({ ...BASE, queue: [BASE.queue![2]] }));
    await settle();
    expect(rows().length).toBe(1);
  });

  it('regression: Remove is a danger item and Move to top a plain one (all buttons were filled alike)', async () => {
    const { rows, menu } = await setup(BASE);
    const items = menu(rows()[1]);
    expect(items.find((b) => b.textContent?.trim() === 'Remove')!.classList.contains('danger')).toBe(true);
    expect(items.find((b) => b.textContent?.trim() === 'Move to top')!.classList.contains('danger')).toBe(false);
  });

  // kantahe-du1.7: a queue row is one line: song, badges and one More button (the Library's pattern, kantahe-tlf.3.3)
  it('regression: a row has one button, More actions for its song, and no Move to top or Remove button in the row', async () => {
    const { rows } = await setup(BASE);
    const buttons = Array.from(rows()[1].querySelectorAll('button'));
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['More actions for Skyfall']);
  });

  it('the More menu of the second row has Move to top and Remove; of the first row only Remove', async () => {
    const { rows, menu } = await setup(BASE);
    expect(menu(rows()[1]).map((b) => b.textContent?.trim())).toEqual(['Move to top', 'Remove']);
    expect(menu(rows()[0]).map((b) => b.textContent?.trim())).toEqual(['Remove']);
  });

  it('Remove sends RemoveFromQueue with the item id and offers Undo', async () => {
    const { rows, click, server, settle, toastEl } = await setup(BASE);
    click(rows()[1], 'Remove');
    await settle();
    expect(server.calls.remove.map((r) => r.itemId)).toEqual(['q2']);
    expect(toastEl.textContent).toContain('Removed Skyfall');
    expect(toastEl.textContent).toContain('Undo');
  });

  it('Undo adds the same song again', async () => {
    const { rows, click, server, settle, toastEl } = await setup(BASE);
    click(rows()[1], 'Remove');
    await settle();
    Array.from(toastEl.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Undo')!.click();
    await settle();
    expect(server.calls.add.map((a) => a.number)).toEqual(['21628']);
  });

  it('Move to top sends MoveToTop, and the first row has none', async () => {
    const { rows, click, menu, server, settle } = await setup(BASE);
    expect(menu(rows()[0]).some((b) => b.textContent?.includes('Move to top'))).toBe(false);
    menu(rows()[0]); // closes it again
    click(rows()[2], 'Move to top');
    await settle();
    expect(server.calls.top.map((r) => r.itemId)).toEqual(['q3']);
  });

  it('regression: a double click on Remove or Move to top sends one command, not two', async () => {
    const { rows, click, server, settle } = await setup(BASE);
    click(rows()[1], 'Remove');
    click(rows()[1], 'Remove');
    click(rows()[2], 'Move to top');
    click(rows()[2], 'Move to top');
    await settle();
    expect(server.calls.remove.map((r) => r.itemId)).toEqual(['q2']);
    expect(server.calls.top.map((r) => r.itemId)).toEqual(['q3']);
  });

  it('a button works again after its command has finished (the same song can be moved later)', async () => {
    const { rows, click, server, settle } = await setup(BASE);
    click(rows()[2], 'Move to top');
    await settle();
    click(rows()[2], 'Move to top');
    await settle();
    expect(server.calls.top.length).toBe(2);
  });

  it('the More button and its menu say which song they are about', async () => {
    const { rows, menu } = await setup(BASE);
    expect(rows()[1].querySelector('button.more')!.getAttribute('aria-label')).toBe('More actions for Skyfall');
    menu(rows()[1]);
    expect(rows()[1].querySelector('[role="menu"]')!.getAttribute('aria-label')).toBe('More actions for Skyfall');
  });

  it('shows the now playing card and the devices', async () => {
    const { el } = await setup(BASE);
    expect(el.querySelector('app-now-playing')).not.toBeNull();
    expect(el.querySelector('app-devices')).not.toBeNull();
  });

  it('tells the user when live updates are interrupted', async () => {
    const { el, server, settle } = await setup(BASE);
    expect(el.textContent).not.toContain('Reconnecting');
    void server;
    TestBed.inject(StateStore).connected.set(false);
    await settle();
    expect(el.querySelector('.notice')?.textContent).toContain('Reconnecting');
  });
});
