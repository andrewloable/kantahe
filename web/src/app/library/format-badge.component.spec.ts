import { TestBed } from '@angular/core/testing';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { BADGE_PALETTE, contrastRatio, FormatBadgeComponent } from './format-badge.component';

async function badge(format: Format) {
  const f = TestBed.createComponent(FormatBadgeComponent);
  f.componentRef.setInput('format', format);
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
});
