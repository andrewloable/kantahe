import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild, viewChildren } from '@angular/core';
import { LyricWord, Lyrics } from '../../../gen/kantahe/v1/common_pb';
import { activeLine, countIn, fitScale, rowsFor, wipe } from './lyrics-logic';

/** The wipe is drawn in steps of 0.4 %: the DOM is only touched when a word has moved that far. */
const STEPS = 250;

@Component({
  selector: 'app-lyrics-view',
  template: `
    <div #box class="lyrics" role="group" aria-label="Lyrics">
      <div class="dots-slot">
        @if (dots() > 0) {
          <div class="dots" aria-hidden="true">
            @for (n of dotNumbers; track n) {
              <span class="dot" [class.lit]="n <= dots()"></span>
            }
          </div>
        }
      </div>
      @for (r of rowLines(); track $index; let i = $index) {
        <div class="row" [class.bright]="r.index === active()" [style.transform]="'scale(' + scales()[i] + ')'">
          <span #content class="content">
            @for (w of r.words; track $index) {
              <span class="word"
                ><span class="base">{{ w.text }}</span
                ><span class="over" aria-hidden="true" [style.clip-path]="clip(w)">{{ w.text }}</span></span
              >
            }
          </span>
        </div>
      }
    </div>
  `,
  styles: `
    .lyrics {
      overflow: hidden;
      text-align: center;
      font-size: clamp(1.5rem, 4vw, 3rem);
      line-height: 1.4;
    }
    .dots-slot {
      height: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .dots {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }
    .dot {
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      background: var(--muted);
      opacity: 0.35;
    }
    .dot.lit {
      background: var(--sung);
      opacity: 1;
    }
    .row {
      display: flex;
      justify-content: center;
      min-height: 1.4em;
      white-space: nowrap;
      color: var(--muted);
      transform-origin: center;
    }
    .row.bright {
      color: var(--text);
    }
    .content {
      display: inline-block;
    }
    .word {
      position: relative;
      display: inline-block;
      white-space: pre;
    }
    .over {
      position: absolute;
      left: 0;
      top: 0;
      color: var(--sung);
    }
  `,
})
export class LyricsViewComponent {
  readonly lyrics = input<Lyrics | undefined>();
  /** The playback position in milliseconds. */
  readonly timeMs = input.required<number>();

  protected readonly dotNumbers = [1, 2, 3, 4];
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly contents = viewChildren<ElementRef<HTMLElement>>('content');

  private readonly lines = computed(() => this.lyrics()?.lines ?? []);
  /** A position that is not a finite number (a player that has not reported yet) counts as the start. */
  private readonly time = computed(() => (Number.isFinite(this.timeMs()) ? this.timeMs() : 0));
  protected readonly active = computed(() => activeLine(this.lines(), this.time()));
  protected readonly dots = computed(() => countIn(this.lines(), this.active(), this.time()));
  protected readonly rowLines = computed(() => {
    const { top, bottom } = rowsFor(this.active());
    return [top, bottom].map((index) => ({ index, words: this.lines()[index]?.words ?? [] }));
  });

  protected readonly scales = signal([1, 1]);
  private readonly width = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterRenderEffect(() => {
      const el = this.box().nativeElement;
      this.width(); // measure again after a resize
      this.rowLines(); // and after the rows show other lines
      this.scales.set(this.contents().map((c) => fitScale(el.clientWidth, c.nativeElement.scrollWidth)));
    });
    afterRenderEffect(() => {
      const el = this.box().nativeElement;
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.width.set(el.clientWidth));
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** The part of the word that is still to be sung is cut off from the right. */
  protected clip(word: LyricWord): string {
    const sung = Math.floor(wipe(word, this.time()) * STEPS) / STEPS;
    return `inset(0 ${Number(((1 - sung) * 100).toFixed(1))}% 0 0)`;
  }
}
