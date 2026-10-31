import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { NowBarComponent } from './now-bar.component';
import { device, fakeSession, PlayStatus, song, stateOf, StateInit } from './testing';
import { Component } from '@angular/core';

@Component({ template: '<app-now-bar />', imports: [NowBarComponent] })
class Host {}

@Component({ template: '' })
class Page {}

const TV = device('tv', 'Living room TV');
const ME = device('me', 'Phone', { isCaller: true });
const PLAYING: StateInit = {
  status: PlayStatus.PLAYING,
  player: 'tv',
  devices: [ME, TV],
  now: { song: song('1', 'Hello', 'Adele'), positionMs: 0, positionAtMs: 1000 },
  queue: [
    { id: 'q1', song: song('2', 'Skyfall', 'Adele') },
    { id: 'q2', song: song('3', 'Rolling in the Deep', 'Adele') },
  ],
};

async function setup(state: StateInit | undefined, url = '/library') {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'library', component: Page },
        { path: 'queue', component: Page },
      ]),
      { provide: TRANSPORT, useValue: server.transport },
    ],
  });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'me' }));
  TestBed.tick();
  if (state) server.push(stateOf(state));
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const fixture = TestBed.createComponent(Host);
  await vi.advanceTimersByTimeAsync(10);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, fixture, harness, server };
}

describe('NowBarComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('with a song playing it shows the title, the artist, where it plays and how many are coming up', async () => {
    const { el } = await setup(PLAYING);
    const bar = el.querySelector('.nowbar')!;
    expect(bar.getAttribute('aria-label')).toBe('Now playing');
    expect(bar.textContent).toContain('Hello');
    expect(bar.textContent).toContain('Adele');
    expect(bar.textContent).toContain('Playing on Living room TV');
    expect(bar.textContent).toContain('2 coming up');
  });

  it('says Paused when it is paused', async () => {
    const { el } = await setup({ ...PLAYING, status: PlayStatus.PAUSED });
    expect(el.querySelector('.nowbar')?.textContent).toContain('Paused on Living room TV');
  });

  it('with nothing playing and an empty queue there is no bar', async () => {
    const { el } = await setup({ status: PlayStatus.PAUSED, devices: [ME] });
    expect(el.querySelector('.nowbar')).toBeNull();
  });

  it('with songs queued and none playing it still shows how many are waiting', async () => {
    const { el } = await setup({ status: PlayStatus.PAUSED, devices: [ME], queue: PLAYING.queue });
    const bar = el.querySelector('.nowbar')!;
    expect(bar.textContent).toContain('Nothing is playing');
    expect(bar.textContent).toContain('2 coming up');
  });

  it('regression: it follows the live state: the next song, a pause, and the bar going away when everything is done', async () => {
    const { el, fixture, server } = await setup(PLAYING);
    expect(el.querySelector('.nowbar')?.textContent).toContain('Hello');
    server.push(stateOf({ ...PLAYING, now: { song: song('2', 'Skyfall', 'Adele'), positionMs: 0, positionAtMs: 1000 }, queue: [{ id: 'q2', song: song('3', 'Rolling in the Deep', 'Adele') }] }));
    await vi.advanceTimersByTimeAsync(20);
    fixture.detectChanges();
    expect(el.querySelector('.nowbar')?.textContent).toContain('Skyfall');
    expect(el.querySelector('.nowbar')?.textContent).toContain('1 coming up');
    server.push(stateOf({ status: PlayStatus.PAUSED, devices: [ME, TV], player: 'tv' }));
    await vi.advanceTimersByTimeAsync(20);
    fixture.detectChanges();
    expect(el.querySelector('.nowbar')).toBeNull();
  });

  it('there is no bar before the first state arrives', async () => {
    const { el } = await setup(undefined);
    expect(el.querySelector('.nowbar')).toBeNull();
  });

  it('the bar is a link to the queue', async () => {
    const { el } = await setup(PLAYING);
    expect(el.querySelector('.nowbar a')?.getAttribute('href')).toBe('/queue');
  });

  it('on the queue page itself there is no bar, and it is back after leaving it', async () => {
    const { el, fixture, harness } = await setup(PLAYING, '/queue');
    expect(el.querySelector('.nowbar')).toBeNull();
    await harness.navigateByUrl('/library');
    fixture.detectChanges();
    expect(el.querySelector('.nowbar')).not.toBeNull();
  });

  it('regression: the bar is a block in the page flow with a target of 44 px or more, so it covers nothing and can be tapped', async () => {
    await setup(PLAYING);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
    expect(css).toMatch(/\.nowbar[^{]*\{[^}]*display:\s*block/);
    expect(css).not.toMatch(/\.nowbar[^{]*\{[^}]*position:\s*(fixed|absolute)/);
    expect(css).toMatch(/\.nowbar[^{]*a[^{]*\{[^}]*min-height:\s*2\.75rem/);
  });
});
