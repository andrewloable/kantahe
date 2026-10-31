import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { LyricLineSchema, LyricsSchema, LyricWordSchema, Lyrics } from '../../../gen/kantahe/v1/common_pb';
import { LyricsViewComponent } from './lyrics-view.component';

const word = (text: string, s: number, e: number) => create(LyricWordSchema, { text, startMs: BigInt(s), endMs: BigInt(e) });

function lyrics(): Lyrics {
  return create(LyricsSchema, {
    number: '1',
    lines: [
      create(LyricLineSchema, { startMs: 6000n, endMs: 8000n, words: [word('Hel', 6000, 6500), word('lo ', 6500, 7000)] }),
      create(LyricLineSchema, { startMs: 9000n, endMs: 11000n, words: [word('Is ', 9000, 9500), word('it ', 9500, 10000)] }),
      create(LyricLineSchema, { startMs: 20000n, endMs: 22000n, words: [word('Me', 20000, 21000)] }),
    ],
  });
}

async function show(timeMs: number, l: Lyrics | undefined = lyrics()) {
  const f = TestBed.createComponent(LyricsViewComponent);
  f.componentRef.setInput('lyrics', l);
  f.componentRef.setInput('timeMs', timeMs);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const move = async (t: number) => {
    f.componentRef.setInput('timeMs', t);
    await f.whenStable();
  };
  return { f, el, move, rows: () => Array.from(el.querySelectorAll<HTMLElement>('.row')) };
}

const text = (row: HTMLElement) => Array.from(row.querySelectorAll('.base')).map((e) => e.textContent).join('');

describe('LyricsViewComponent', () => {
  it('shows two rows: even lines on top, odd lines below', async () => {
    const { rows } = await show(6100);
    expect(rows().length).toBe(2);
    expect(text(rows()[0])).toBe('Hello ');
    expect(text(rows()[1])).toBe('Is it ');
  });

  it('the active row is bright, the other dim', async () => {
    const { rows, move } = await show(6100);
    expect(rows()[0].classList.contains('bright')).toBe(true);
    expect(rows()[1].classList.contains('bright')).toBe(false);
    await move(9100);
    expect(rows()[0].classList.contains('bright')).toBe(false);
    expect(rows()[1].classList.contains('bright')).toBe(true);
  });

  it('after the second line the top row moves on to the third', async () => {
    const { rows } = await show(9100 + 10_000);
    expect(text(rows()[0])).toBe('Me');
    expect(text(rows()[1])).toBe('Is it ');
  });

  it('a half-sung word is clipped to its left half', async () => {
    const { el } = await show(6250); // "Hel" runs 6000-6500
    const overlays = el.querySelectorAll<HTMLElement>('.row')[0].querySelectorAll<HTMLElement>('.over');
    expect(overlays[0].style.getPropertyValue('clip-path')).toBe('inset(0 50% 0 0)');
    expect(overlays[1].style.getPropertyValue('clip-path')).toBe('inset(0 100% 0 0)'); // not sung yet
  });

  it('a sung word is not clipped', async () => {
    const { el } = await show(7500);
    const overlays = el.querySelectorAll<HTMLElement>('.row')[0].querySelectorAll<HTMLElement>('.over');
    expect(overlays[0].style.getPropertyValue('clip-path')).toBe('inset(0 0% 0 0)');
    expect(overlays[1].style.getPropertyValue('clip-path')).toBe('inset(0 0% 0 0)');
  });

  it('only moves the wipe when it has moved by 0.4 %', async () => {
    const { el, move } = await show(6000);
    const over = () => el.querySelectorAll<HTMLElement>('.row')[0].querySelectorAll<HTMLElement>('.over')[0].style.getPropertyValue('clip-path');
    const first = over();
    await move(6001); // 0.2 % of a 500 ms word
    expect(over()).toBe(first);
    await move(6003); // 0.6 %
    expect(over()).not.toBe(first);
  });

  it('draws the sung colour as a second copy of the word, hidden from screen readers', async () => {
    const { rows } = await show(6100);
    const w = rows()[0].querySelector('.word')!;
    expect(w.querySelector('.base')?.textContent).toBe('Hel');
    expect(w.querySelector('.over')?.textContent).toBe('Hel');
    expect(w.querySelector('.over')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the count-in dots before the first line, and none once the line has started', async () => {
    const a = await show(2500);
    const dots = a.el.querySelectorAll('.dots .dot');
    expect(dots.length).toBe(4);
    expect(a.el.querySelectorAll('.dots .dot.lit').length).toBe(4);
    expect(a.el.querySelector('.dots')?.getAttribute('aria-hidden')).toBe('true');
    await a.move(5500);
    expect(a.el.querySelectorAll('.dots .dot.lit').length).toBe(1);
    await a.move(6100);
    expect(a.el.querySelector('.dots')).toBeNull();
  });

  it('shows no dots when the first line comes early', async () => {
    const early = create(LyricsSchema, { lines: [create(LyricLineSchema, { startMs: 3000n, endMs: 4000n, words: [word('Hi', 3000, 3500)] })] });
    const { el } = await show(1000, early);
    expect(el.querySelector('.dots')).toBeNull();
  });

  it('regression: a position that is not a number draws nothing sung and nothing broken', async () => {
    const { el, rows } = await show(Number.NaN);
    const overlays = el.querySelector('.row')!.querySelectorAll<HTMLElement>('.over');
    expect(overlays[0].style.getPropertyValue('clip-path')).toBe('inset(0 100% 0 0)');
    expect(rows().length).toBe(2);
    const infinite = await show(Number.POSITIVE_INFINITY);
    expect(infinite.rows().length).toBe(2);
  });

  it('copes with no lyrics and with a song without lines', async () => {
    expect((await show(1000, undefined)).rows().length).toBe(2);
    const none = await show(1000, create(LyricsSchema, {}));
    expect(none.rows().every((r) => text(r) === '')).toBe(true);
  });

  describe('fitting to the width', () => {
    afterEach(() => vi.restoreAllMocks());

    it('scales a row that is wider than the container down to fit', async () => {
      vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(2000);
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000);
      const { rows, f } = await show(6100);
      f.detectChanges();
      await f.whenStable();
      expect(rows()[0].style.transform).toBe('scale(0.5)');
    });

    it('leaves a row that fits alone', async () => {
      vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(400);
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000);
      const { rows, f } = await show(6100);
      f.detectChanges();
      await f.whenStable();
      expect(rows()[0].style.transform).toBe('scale(1)');
    });

    it('measures again when the container is resized', async () => {
      let width = 1000;
      const observers: (() => void)[] = [];
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            observers.push(cb);
          }
          observe() {
            // measured through the callbacks collected above
          }
          disconnect() {
            // nothing to release
          }
        },
      );
      vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(2000);
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => width);
      const { rows, f } = await show(6100);
      expect(rows()[0].style.transform).toBe('scale(0.5)');
      width = 500;
      observers.forEach((cb) => cb());
      await f.whenStable();
      expect(rows()[0].style.transform).toBe('scale(0.25)');
      vi.unstubAllGlobals();
    });
  });
});
