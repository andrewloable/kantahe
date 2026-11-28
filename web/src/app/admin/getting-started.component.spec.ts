import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import { AdminService, ListUsersResponseSchema } from '../../gen/kantahe/v1/admin_pb';
import { CatalogService, SearchSongsResponseSchema } from '../../gen/kantahe/v1/catalog_pb';
import { SongSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { StateStore } from '../core/state.store';
import { StateSchema } from '../../gen/kantahe/v1/session_pb';
import { GettingStartedComponent } from './getting-started.component';

// kantahe-qzr.7: the first steps of a new server, on the Administration page
async function setup(opts: { songs?: number; users?: number; hold?: Promise<void> } = {}) {
  const transport = createRouterTransport(({ service }) => {
    service(AdminService, {
      async listUsers() {
        await opts.hold;
        return create(ListUsersResponseSchema, { users: Array.from({ length: opts.users ?? 1 }, (_, i) => create(UserSchema, { id: `u${i}` })) });
      },
    });
    service(CatalogService, {
      searchSongs() {
        return create(SearchSongsResponseSchema, { songs: Array.from({ length: opts.songs ?? 0 }, (_, i) => create(SongSchema, { number: String(i + 1) })) });
      },
    });
  });
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: transport }] });
  const fixture = TestBed.createComponent(GettingStartedComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  const states = () => Array.from(el.querySelectorAll('li .state')).map((s) => s.textContent?.trim());
  return { fixture, el, settle, states };
}

describe('GettingStartedComponent', () => {
  beforeEach(() => localStorage.clear());

  it('regression: a new server (no songs, only the administrator) shows the three steps to do, each a link to its page', async () => {
    const { el, settle, states } = await setup();
    await settle();
    expect(el.querySelector('h2')?.textContent).toBe('Getting started');
    expect(Array.from(el.querySelectorAll('li a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Add songs', '/admin/upload'],
      ['Add the singers as users', '/admin/users'],
      ['Open the Player on the TV or a laptop and press Play here', '/player'],
    ]);
    expect(states()).toEqual(['To do', 'To do', 'To do']);
  });

  it('shows at once, saying Checking…, so that the page does not move when the answers come', async () => {
    let release!: () => void;
    const { el, settle, states } = await setup({ hold: new Promise((r) => (release = r)) });
    expect(el.querySelector('section')).not.toBeNull();
    expect(states()[1]).toBe('Checking…');
    release();
    await settle();
    expect(states()[1]).toBe('To do');
  });

  it('songs and more than one user mark the first two steps done, with a check mark and the word', async () => {
    const { settle, states, el } = await setup({ songs: 1, users: 3 });
    await settle();
    expect(states()).toEqual(['Done', 'Done', 'To do']);
    expect(el.querySelectorAll('li.done').length).toBe(2);
  });

  it('a player device marks the third step done', async () => {
    const { settle, states, fixture } = await setup({ songs: 1, users: 3 });
    TestBed.inject(StateStore).state.set(create(StateSchema, { playerDeviceId: 'd1' }));
    await settle();
    fixture.detectChanges();
    expect(states()).toEqual(['Done', 'Done', 'Done']);
  });

  it('all done: it says so this time and is not shown on the next visit', async () => {
    const first = await setup({ songs: 1, users: 3 });
    TestBed.inject(StateStore).state.set(create(StateSchema, { playerDeviceId: 'd1' }));
    await first.settle();
    expect(first.el.textContent).toContain('Everything is set up');
    TestBed.resetTestingModule();
    const again = await setup({ songs: 1, users: 3 });
    await again.settle();
    expect(again.el.querySelector('section')).toBeNull();
  });

  it('Hide hides it for good', async () => {
    const first = await setup();
    await first.settle();
    Array.from(first.el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Hide')!.click();
    first.fixture.detectChanges();
    expect(first.el.querySelector('section')).toBeNull();
    TestBed.resetTestingModule();
    const again = await setup();
    await again.settle();
    expect(again.el.querySelector('section')).toBeNull();
  });
});
