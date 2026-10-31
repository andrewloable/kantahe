import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
import { ToastService } from '../core/toast';
import { LibraryActions } from './library-actions';
import { fakeLibrary, FakeLibrary, song } from './testing';

function setup(h: FakeLibrary = {}) {
  const f = fakeLibrary(h);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
  return { ...f, actions: TestBed.inject(LibraryActions), toasts: TestBed.inject(ToastService) };
}

describe('LibraryActions.add', () => {
  it('queues the song by number and says so', async () => {
    const { actions, calls, toasts } = setup();
    expect(await actions.add(song('01052', 'Hello', 'Adele'))).toBe(true);
    expect(calls.add.map((c) => c.number)).toEqual(['01052']);
    expect(toasts.toasts().map((t) => [t.message, t.kind])).toEqual([['Added Hello', 'info']]);
  });

  it('shows a failure as an error toast', async () => {
    const { actions, toasts } = setup({
      addToQueue: () => {
        throw new ConnectError('x', Code.Unavailable);
      },
    });
    expect(await actions.add(song('1', 'Hello', 'A'))).toBe(false);
    expect(toasts.toasts()[0].kind).toBe('error');
    expect(toasts.toasts()[0].message).toMatch(/could not reach the server/i);
  });

  it('says when the song is gone', async () => {
    const { actions, toasts } = setup({
      addToQueue: () => {
        throw new ConnectError('not found', Code.NotFound);
      },
    });
    await actions.add(song('1', 'Hello', 'A'));
    expect(toasts.toasts()[0].message).toBe('That song is no longer in the library.');
  });

  it('does not queue a song that cannot be played', async () => {
    const { actions, calls, toasts } = setup();
    const bad = song('1', 'Broken', 'A');
    bad.failed = true;
    expect(await actions.add(bad)).toBe(false);
    expect(calls.add.length).toBe(0);
    expect(toasts.toasts()[0].kind).toBe('error');
  });
});

describe('LibraryActions.toggleFavourite', () => {
  it('flips the star at once and tells the server', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { actions, calls } = setup({ setFavourite: () => gate });
    const s = song('7', 'T', 'A');
    expect(actions.isFavourite(s)).toBe(false);
    const done = actions.toggleFavourite(s);
    expect(actions.isFavourite(s)).toBe(true); // optimistic, before the answer
    release();
    await done;
    expect(calls.fav.map((c) => [c.number, c.favourite])).toEqual([['7', true]]);
    expect(actions.isFavourite(s)).toBe(true);
  });

  it('turns a favourite off', async () => {
    const { actions, calls } = setup();
    const s = song('7', 'T', 'A', undefined, true);
    expect(actions.isFavourite(s)).toBe(true);
    await actions.toggleFavourite(s);
    expect(calls.fav.map((c) => c.favourite)).toEqual([false]);
    expect(actions.isFavourite(s)).toBe(false);
  });

  it('puts the star back and shows an error when the server refuses', async () => {
    const { actions, toasts } = setup({
      setFavourite: () => {
        throw new ConnectError('x', Code.Internal);
      },
    });
    const s = song('7', 'T', 'A');
    await actions.toggleFavourite(s);
    expect(actions.isFavourite(s)).toBe(false);
    expect(toasts.toasts()[0].kind).toBe('error');
  });

  it('every row of the same song follows (the state is shared by number)', async () => {
    const { actions } = setup();
    const a = song('7', 'T', 'A');
    const b = song('7', 'T', 'A');
    await actions.toggleFavourite(a);
    expect(actions.isFavourite(b)).toBe(true);
  });
});

describe('LibraryActions.adopt', () => {
  it('regression: a fresh list from the server replaces a star this page remembered (it may have changed elsewhere)', async () => {
    const { actions } = setup();
    await actions.toggleFavourite(song('7', 'T', 'A')); // starred here
    expect(actions.isFavourite(song('7', 'T', 'A'))).toBe(true);
    const fresh = song('7', 'T', 'A', undefined, false); // unstarred on another device since
    actions.adopt([fresh]);
    expect(actions.isFavourite(fresh)).toBe(false);
  });

  it('every list shows the newest known star, including rows loaded earlier', async () => {
    const { actions } = setup();
    const old = song('7', 'T', 'A', undefined, false);
    actions.adopt([song('7', 'T', 'A', undefined, true)]);
    expect(actions.isFavourite(old)).toBe(true);
  });

  it('does not undo a star that is still being saved', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { actions } = setup({ setFavourite: () => gate });
    const s = song('7', 'T', 'A');
    const saving = actions.toggleFavourite(s);
    actions.adopt([song('7', 'T', 'A', undefined, false)]); // a list that was read before the star was saved
    expect(actions.isFavourite(s)).toBe(true);
    release();
    await saving;
    expect(actions.isFavourite(s)).toBe(true);
  });
});

describe('LibraryActions across sign-ins', () => {
  it('regression: another user who signs in on the same page does not see the stars of the one before', async () => {
    const { actions } = setup();
    const auth = TestBed.inject(AuthStore);
    auth.signIn(create(AuthTokenSchema, { token: 'a', deviceId: 'd1' }));
    TestBed.tick();
    await actions.toggleFavourite(song('7', 'T', 'A'));
    expect(actions.isFavourite(song('7', 'T', 'A'))).toBe(true);
    auth.signOut();
    TestBed.tick();
    auth.signIn(create(AuthTokenSchema, { token: 'b', deviceId: 'd2' }));
    TestBed.tick();
    expect(actions.isFavourite(song('7', 'T', 'A'))).toBe(false);
  });
});
