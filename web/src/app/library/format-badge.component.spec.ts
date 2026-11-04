import { TestBed } from '@angular/core/testing';
import { Format, LyricTiming } from '../../gen/kantahe/v1/common_pb';
import { BADGE_PALETTE, contrastRatio, FormatBadgeComponent } from './format-badge.component';

async function badge(format: Format, extra: { timing?: LyricTiming; vocals?: boolean } = {}) {
  const f = TestBed.createComponent(FormatBadgeComponent);
  f.componentRef.setInput('format', format);
  if (extra.timing !== undefined) f.componentRef.setInput('timing', extra.timing);
  if (extra.vocals !== undefined) f.componentRef.setInput('vocals', extra.vocals);
  await f.whenStable();
  return f.nativeElement as HTMLElement;
}

describe('FormatBadge', () => {
  it('says MP3 or MIDI in text', async () => {
    expect((await badge(Format.MP3)).textContent?.trim()).toBe('MP3');
    expect((await badge(Format.MIDI)).textContent?.trim()).toBe('MIDI');
  });

  it('says nothing for an unknown format', async () => {
    expect((await badge(Format.UNSPECIFIED)).textContent?.trim()).toBe('');
  });

  it('the two formats look different', async () => {
    const a = (await badge(Format.MP3)).querySelector('span')?.className;
    const b = (await badge(Format.MIDI)).querySelector('span')?.className;
    expect(a).not.toBe(b);
  });

  it('every colour pair has a contrast of at least 4.5:1, in light and dark themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const kind of ['mp3', 'midi'] as const) {
        const { bg, fg } = BADGE_PALETTE[theme][kind];
        expect(contrastRatio(bg, fg), `${theme} ${kind}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('contrastRatio is the WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('the stylesheet really uses the palette', async () => {
    await badge(Format.MP3);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n').toLowerCase();
    for (const theme of ['light', 'dark'] as const) {
      for (const kind of ['mp3', 'midi'] as const) {
        expect(css, `${theme} ${kind} background`).toContain(BADGE_PALETTE[theme][kind].bg);
        expect(css, `${theme} ${kind} text`).toContain(BADGE_PALETTE[theme][kind].fg);
      }
    }
  });

  describe('lyric timing and vocals', () => {
    const spans = (el: HTMLElement) => Array.from(el.querySelectorAll('span')).map((x) => [x.textContent?.trim(), x.getAttribute('aria-label'), x.getAttribute('title')]);

    it('a word-timed song shows W after the format, with an accessible name', async () => {
      const el = await badge(Format.MP3, { timing: LyricTiming.WORD });
      expect(spans(el)).toEqual([
        ['MP3', null, null],
        ['W', 'Word-by-word lyrics', 'Word-by-word lyrics'],
      ]);
    });

    it('a line-timed song shows L', async () => {
      const el = await badge(Format.MIDI, { timing: LyricTiming.LINE });
      expect(spans(el)).toEqual([
        ['MIDI', null, null],
        ['L', 'Line-by-line lyrics', 'Line-by-line lyrics'],
      ]);
    });

    it('a song with a separate vocals track shows V last', async () => {
      const el = await badge(Format.MP3, { timing: LyricTiming.WORD, vocals: true });
      expect(spans(el)).toEqual([
        ['MP3', null, null],
        ['W', 'Word-by-word lyrics', 'Word-by-word lyrics'],
        ['V', 'Separate vocals track available', 'Separate vocals track available'],
      ]);
    });

    it('vocals alone: V after the format', async () => {
      expect(spans(await badge(Format.MP3, { vocals: true }))).toEqual([
        ['MP3', null, null],
        ['V', 'Separate vocals track available', 'Separate vocals track available'],
      ]);
    });

    it('the W, L and V badges have role img, so that their label is read (an aria-label on a plain span is not); the format badge has none', async () => {
      const roles = (el: HTMLElement) => Array.from(el.querySelectorAll('span')).map((x) => [x.textContent?.trim(), x.getAttribute('role')]);
      expect(roles(await badge(Format.MP3, { timing: LyricTiming.WORD, vocals: true }))).toEqual([
        ['MP3', null],
        ['W', 'img'],
        ['V', 'img'],
      ]);
      expect(roles(await badge(Format.MIDI, { timing: LyricTiming.LINE }))).toEqual([
        ['MIDI', null],
        ['L', 'img'],
      ]);
    });

    it('an unread song and a song without a vocals track show no extra badge, and the markup is the one of before', async () => {
      const plain = await badge(Format.MP3);
      const same = await badge(Format.MP3, { timing: LyricTiming.UNSPECIFIED, vocals: false });
      expect(same.innerHTML).toBe(plain.innerHTML);
      expect(plain.querySelectorAll('span').length).toBe(1);
    });

    it('the timing badge still shows when the format is not known', async () => {
      expect(spans(await badge(Format.UNSPECIFIED, { timing: LyricTiming.WORD })).map((x) => x[0])).toEqual(['W']);
    });
  });
});
