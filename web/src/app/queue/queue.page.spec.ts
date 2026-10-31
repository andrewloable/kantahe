import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
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
    { id: 'q1', song: song('01052', 'Hello', 'Adele', Format.MP3) },
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
  const click = (row: HTMLElement, name: string) => Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(name))!.click();
  return { fixture, el, server, settle, rows, click, toastEl: toastsFixture.nativeElement as HTMLElement, toasts: TestBed.inject(ToastService) };
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
    expect(rows()[1].textContent).toContain('Skyfall');
    expect(rows()[1].textContent).toContain('MIDI');
    expect(rows()[2].textContent).toContain('Third');
  });

  it('says so when the queue is empty', async () => {
    const { el } = await setup({ ...BASE, queue: [] });
    expect(el.textContent).toContain('The queue is empty');
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
    const { rows, click, server, settle } = await setup(BASE);
    expect(Array.from(rows()[0].querySelectorAll('button')).some((b) => b.textContent?.includes('Move to top'))).toBe(false);
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

  it('every row button says which song it is about', async () => {
    const { rows } = await setup(BASE);
    const labels = Array.from(rows()[1].querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Remove Skyfall from the queue');
    expect(labels).toContain('Move Skyfall to the top of the queue');
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
