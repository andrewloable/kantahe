import { TestBed } from '@angular/core/testing';
import { TRANSPORT } from '../core/api';
import { FavouritesComponent } from './favourites.component';
import { fakeMe, song } from './testing';

const FAVS = [song('1', 'Alpha', 'A'), song('2', 'Bravo', 'B'), song('3', 'Charlie', 'C')].map((s) => Object.assign(s, { favourite: true }));

async function setup(favourites = FAVS, pageSize?: number) {
  const server = fakeMe({ favourites, pageSize });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(FavouritesComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await vi.waitFor(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  return { fixture, el, server, settle };
}

describe('FavouritesComponent', () => {
  it('lists the favourites in pages, reading the next one ahead', async () => {
    const { el, server, settle } = await setup();
    await settle();
    expect(el.querySelectorAll('li.row').length).toBe(3); // the second page is read ahead by itself
    expect(server.calls.favourites).toEqual(['', '2']);
    expect(Array.from(el.querySelectorAll('.title')).map((e) => e.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('un-starring a song takes it off the list', async () => {
    const { el, fixture, settle } = await setup();
    el.querySelector<HTMLButtonElement>('li.row button.star')!.click();
    await settle();
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.title')).map((e) => e.textContent)).toEqual(['Bravo', 'Charlie']);
  });

  it('regression: after un-starring, the pages that follow still show the favourites that are left (the server pages by position, which moved)', async () => {
    const many = Array.from({ length: 130 }, (_, i) => Object.assign(song(String(i + 1), `S${i + 1}`, 'A'), { favourite: true }));
    const { el, fixture, settle } = await setup(many, 50);
    const titles = () => Array.from(el.querySelectorAll('.title')).map((e) => e.textContent);
    el.querySelector<HTMLButtonElement>('li.row button.star')!.click(); // S1 goes
    await settle();
    await settle();
    const next = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Next')!;
    expect(titles()[0]).toBe('S2');
    next().click();
    await settle();
    next().click();
    await settle();
    await settle();
    fixture.detectChanges();
    expect(titles()[0]).toBe('S102');
    expect(titles().length).toBe(29); // S102..S130: none skipped, none twice
    expect(titles().at(-1)).toBe('S130');
  });

  it('says so when there are no favourites', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('You have no favourites yet.');
  });

  it('has a heading', async () => {
    const { el } = await setup();
    expect(el.querySelector('h2')?.textContent).toBe('Favourites');
  });
});
