import { TestBed } from '@angular/core/testing';
import { TRANSPORT } from '../core/api';
import { FavouritesComponent } from './favourites.component';
import { fakeMe, song } from './testing';

const FAVS = [song('1', 'Alpha', 'A'), song('2', 'Bravo', 'B'), song('3', 'Charlie', 'C')].map((s) => Object.assign(s, { favourite: true }));

async function setup(favourites = FAVS) {
  const server = fakeMe({ favourites });
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
  it('lists the favourites in pages', async () => {
    const { el, server, settle } = await setup();
    expect(el.querySelectorAll('li.row').length).toBe(2);
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
    await settle();
    expect(server.calls.favourites).toEqual(['', '2']);
    expect(Array.from(el.querySelectorAll('.title')).map((e) => e.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('un-starring a song takes it off the list', async () => {
    const { el, fixture, settle } = await setup();
    el.querySelector<HTMLButtonElement>('li.row button.star')!.click();
    await settle();
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.title')).map((e) => e.textContent)).toEqual(['Bravo']);
  });

  it('regression: after un-starring, Load more still shows the favourites that are left (the server pages by position, which moved)', async () => {
    const { el, fixture, settle } = await setup();
    el.querySelector<HTMLButtonElement>('li.row button.star')!.click(); // Alpha goes
    await settle();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
    await settle();
    await settle();
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.title')).map((e) => e.textContent)).toEqual(['Bravo', 'Charlie']);
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
