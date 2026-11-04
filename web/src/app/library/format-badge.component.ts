import { Component, computed, input } from '@angular/core';
import { Format, LyricTiming } from '../../gen/kantahe/v1/common_pb';

/** Badge colours; the stylesheet below uses exactly these (a test checks that, and the contrast). */
export const BADGE_PALETTE = {
  light: { mp3: { bg: '#0b5d8a', fg: '#ffffff' }, midi: { bg: '#7a3e00', fg: '#ffffff' } },
  dark: { mp3: { bg: '#4fd1ff', fg: '#0c1230' }, midi: { bg: '#ffd23f', fg: '#0c1230' } },
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

@Component({
  selector: 'app-format-badge',
  template: `
    @if (label()) {
      <span class="badge" [class.mp3]="format() === Format.MP3" [class.midi]="format() === Format.MIDI">{{ label() }}</span>
    }
    @if (timingLabel(); as t) {
      <span class="badge flag timing-badge" role="img" [attr.title]="t.text" [attr.aria-label]="t.text">{{ t.letter }}</span>
    }
    @if (vocals()) {
      <span class="badge flag vocals-badge" role="img" title="Separate vocals track available" aria-label="Separate vocals track available">V</span>
    }
  `,
  styles: `
    :host {
      /* the format, W or L, and V sit side by side and wrap when the place is narrow (a phone row) */
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .badge {
      display: inline-block;
      padding: 0.1rem 0.45rem;
      border-radius: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .flag {
      border: 1px solid currentColor;
      background: transparent;
    }
    .mp3 {
      background: #0b5d8a;
      color: #ffffff;
    }
    .midi {
      background: #7a3e00;
      color: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      .mp3 {
        background: #4fd1ff;
        color: #0c1230;
      }
      .midi {
        background: #ffd23f;
        color: #0c1230;
      }
    }
  `,
})
export class FormatBadgeComponent {
  readonly format = input.required<Format>();
  protected readonly Format = Format;
  /** How the lyrics are timed (the W or L badge); UNSPECIFIED shows nothing. */
  readonly timing = input<LyricTiming>(LyricTiming.UNSPECIFIED);
  /** The song has a separate vocals track (the V badge). */
  readonly vocals = input(false);
  protected readonly timingLabel = computed(() =>
    this.timing() === LyricTiming.WORD
      ? { letter: 'W', text: 'Word-by-word lyrics' }
      : this.timing() === LyricTiming.LINE
        ? { letter: 'L', text: 'Line-by-line lyrics' }
        : undefined,
  );
  protected readonly label = computed(() => (this.format() === Format.MP3 ? 'MP3' : this.format() === Format.MIDI ? 'MIDI' : ''));
}
