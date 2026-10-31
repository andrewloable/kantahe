import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { ArtistSchema, SongSort } from '../../gen/kantahe/v1/catalog_pb';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AlphaBrowseComponent } from './alpha-browse.component';
import { fakeLibrary, FakeLibrary, song } from './testing';

const artist = (name: string, n: number) => create(ArtistSchema, { name, songCount: n });

function setup(h: FakeLibrary = {}) {
  const f = fakeLibrary(h);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
  const fixture = TestBed.createComponent(AlphaBrowseComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const letter = async (l: string) => {
    Array.from(el.querySelectorAll<HTMLButtonElement>('.letters button')).find((b) => b.textContent?.trim() === l)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const mode = async (m: 'Titles' | 'Artists') => {
    Array.from(el.querySelectorAll<HTMLButtonElement>('.modes button')).find((b) => b.textContent?.trim() === m)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, el, letter, mode, ...f };
}

describe('AlphaBrowseComponent', () => {
  it('offers A to Z and #, each a labelled toggle button', async () => {
    const { el, fixture } = setup();
    await fixture.whenStable();
    const letters = Array.from(el.querySelectorAll<HTMLButtonElement>('.letters button'));
    expect(letters.map((b) => b.textContent?.trim()).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ#');
    expect(letters.every((b) => b.hasAttribute('aria-pressed'))).toBe(true);
    expect(letters[0].getAttribute('aria-pressed')).toBe('true'); // A is where it starts
  });

  it('starts with the titles under A, sorted by title', async () => {
    const { calls } = setup({ searchSongs: () => ({ items: [song('1', 'Abba', 'X')] }) });
    await vi.waitFor(() => expect(calls.search.length).toBe(1));
    expect(calls.search[0].sort).toBe(SongSort.TITLE);
    expect(calls.search[0].letter).toBe('A');
    expect(calls.search[0].query).toBe('');
  });

  it('a letter in Titles mode searches that letter', async () => {
    const { calls, letter, fixture } = setup();
    await fixture.whenStable();
    await letter('H');
    expect(calls.search.at(-1)?.letter).toBe('H');
    expect(calls.search.at(-1)?.sort).toBe(SongSort.TITLE);
    await letter('#');
    expect(calls.search.at(-1)?.letter).toBe('#');
  });

  it('Artists mode lists the artists of the letter with their song counts', async () => {
    const { calls, letter, mode, el, fixture } = setup({ listArtists: (r) => ({ items: [artist(`${r.letter}dele`, 3)] }) });
    await fixture.whenStable();
    await letter('H');
    await mode('Artists');
    expect(calls.artists.at(-1)?.letter).toBe('H');
    expect(el.textContent).toContain('Hdele');
    expect(el.textContent).toContain('3 songs');
  });

  it('choosing an artist shows that artist\'s songs by title, and Back returns to the artists', async () => {
    const { calls, mode, el, fixture } = setup({
      listArtists: () => ({ items: [artist('Adele', 1)] }),
      searchSongs: (r) => ({ items: r.query === 'Adele' ? [song('1', 'Hello', 'Adele', Format.MP3), song('2', 'Hello', 'Adele', Format.MIDI)] : [] }),
    });
    await fixture.whenStable();
    await mode('Artists');
    el.querySelector<HTMLButtonElement>('.artists button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(calls.search.at(-1)?.query).toBe('Adele');
    expect(calls.search.at(-1)?.sort).toBe(SongSort.TITLE);
    expect(calls.search.at(-1)?.letter).toBe('');
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.textContent).toContain('Adele');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Back'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.artists')).not.toBeNull();
  });

  it('changing the letter while looking at an artist goes back to the list', async () => {
    const { mode, letter, el, fixture } = setup({ listArtists: () => ({ items: [artist('Adele', 1)] }) });
    await fixture.whenStable();
    await mode('Artists');
    el.querySelector<HTMLButtonElement>('.artists button')!.click();
    await fixture.whenStable();
    await letter('B');
    fixture.detectChanges();
    expect(el.querySelector('.artists')).not.toBeNull();
  });

  it('Load more pages the artists with the returned token', async () => {
    const { calls, mode, el, fixture } = setup({
      listArtists: (r) => (r.pageToken === '' ? { items: [artist('Abba', 1)], next: 't2' } : { items: [artist('Adele', 2)] }),
    });
    await fixture.whenStable();
    await mode('Artists');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(calls.artists.map((c) => c.pageToken)).toEqual(['', 't2']);
    expect(el.textContent).toContain('Abba');
    expect(el.textContent).toContain('Adele');
  });
});
