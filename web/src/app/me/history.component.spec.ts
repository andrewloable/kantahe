import { TestBed } from '@angular/core/testing';
import { Format, LyricTiming } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { HistoryComponent } from './history.component';
import { fakeMe, historyEntry, song } from './testing';

const WHEN = 1_767_268_800n; // some moment; shown in the local time zone

async function setup(history = [
  historyEntry(song('1', 'Alpha', 'A', Format.MP3, false, { lyricTiming: LyricTiming.LINE, hasVocals: true }), { hasScore: true, score: 87, sungAtUnix: WHEN }),
  historyEntry(song('2', 'Bravo', 'B'), { skipped: true, sungAtUnix: WHEN + 60n }),
  historyEntry(song('3', 'Charlie', 'C'), { sungAtUnix: WHEN + 120n }),
]) {
  const server = fakeMe({ history });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(HistoryComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  return { fixture, el, server, settle };
}

describe('HistoryComponent', () => {
  it('Play next in the More menu of a row puts that song right after the current one', async () => {
    const { el, settle, server } = await setup();
    const row = el.querySelectorAll('li')[1];
    const more = row.querySelector<HTMLButtonElement>('button.more')!;
    expect(more.getAttribute('aria-label')).toBe('More actions for Bravo');
    more.click();
    await settle();
    Array.from(row.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent?.trim() === 'Play next')!.click();
    await settle();
    await settle();
    expect(server.calls.session).toEqual(['add 2', 'top q-2']);
  });

  it('shows the score, "skipped", or that there was no score', async () => {
    const { el, settle } = await setup();
    let rows = Array.from(el.querySelectorAll('li'));
    expect(rows[0].textContent).toContain('Score 87');
    expect(rows[1].textContent).toContain('skipped');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
    await settle();
    rows = Array.from(el.querySelectorAll('li'));
    expect(rows[2].textContent).toContain('No score');
    expect(rows[2].textContent).not.toContain('skipped');
  });

  it('shows when it was, in the local time', async () => {
    const { el } = await setup();
    const when = new Date(Number(WHEN) * 1000);
    expect(el.querySelector('li time')?.getAttribute('datetime')).toBe(when.toISOString());
    expect(el.querySelector('li time')?.textContent).toBe(when.toLocaleString());
  });

  it('shows title, artist and the format badge', async () => {
    const { el } = await setup();
    const row = el.querySelector('li')!;
    expect(row.textContent).toContain('Alpha');
    expect(row.textContent).toContain('A');
    expect(row.textContent).toContain('MP3');
    expect(row.querySelector('.timing-badge')?.textContent).toBe('L');
    expect(row.querySelector('.vocals-badge')?.textContent).toBe('V');
  });

  it('pages with the returned token', async () => {
    const { server, el, settle } = await setup();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
    await settle();
    expect(server.calls.history).toEqual(['', '2']);
  });

  it('Sing again adds the song to the queue; its name starts with what it shows (WCAG 2.5.3)', async () => {
    const { el, server, settle } = await setup();
    const sing = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Sing again'))!;
    expect(sing.getAttribute('aria-label')).toMatch(/^Sing again: /);
    sing.click();
    await settle();
    expect(server.calls.add).toEqual(['1']);
  });

  it('says so when nothing was sung yet', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('Nothing sung yet.');
  });
});
