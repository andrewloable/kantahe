import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { ScoreLevel, ScoreMode, SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';

const MODES = [
  { value: ScoreMode.OFF, label: 'Off', hint: 'No score after a song.' },
  { value: ScoreMode.RANDOM, label: 'Random', hint: 'A score for every song, for fun.' },
  { value: ScoreMode.MICROPHONE, label: 'Microphone', hint: 'The score follows how loud you sing; the device that plays needs a microphone.' },
];

const LEVELS = [
  { value: ScoreLevel.LOW, label: 'Low', hint: 'Scores from 50 to 100.' },
  { value: ScoreLevel.MIDDLE, label: 'Middle', hint: 'Scores from 60 to 100.' },
  { value: ScoreLevel.HIGH, label: 'High', hint: 'Scores from 80 to 100.' },
];

@Component({
  selector: 'app-score-settings',
  template: `
    <h2>Score</h2>
    <fieldset>
      <legend>Score</legend>
      @for (m of modes; track m.value) {
        <div class="option">
          <input type="radio" name="mode" [id]="'mode-' + m.value" [value]="m.value" [checked]="mode() === m.value" [attr.aria-describedby]="'mode-hint-' + m.value" (change)="choose('mode', m.value)" />
          <label [for]="'mode-' + m.value">{{ m.label }}</label>
          <span class="hint" [id]="'mode-hint-' + m.value">{{ m.hint }}</span>
        </div>
      }
      @if (!canListen()) {
        <p class="hint">Needs a device with a microphone, on a secure page (HTTPS). None of your devices has said it can listen yet.</p>
      }
    </fieldset>
    <fieldset>
      <legend>Level</legend>
      @for (l of levels; track l.value) {
        <div class="option">
          <input type="radio" name="level" [id]="'level-' + l.value" [value]="l.value" [checked]="level() === l.value" [attr.aria-describedby]="'level-hint-' + l.value" (change)="choose('level', l.value)" />
          <label [for]="'level-' + l.value">{{ l.label }}</label>
          <span class="hint" [id]="'level-hint-' + l.value">{{ l.hint }}</span>
        </div>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      margin: 0 0 1rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    .option {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .option label {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      margin: 0;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
  `,
})
export class ScoreSettingsComponent {
  private readonly session = injectClient(SessionService);
  private readonly store = inject(StateStore);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly modes = MODES;
  protected readonly levels = LEVELS;
  private readonly pendingMode = signal<ScoreMode | undefined>(undefined);
  private readonly pendingLevel = signal<ScoreLevel | undefined>(undefined);

  protected readonly mode = computed(() => this.pendingMode() ?? this.store.state()?.settings?.scoreMode ?? ScoreMode.RANDOM);
  protected readonly level = computed(() => this.pendingLevel() ?? this.store.state()?.settings?.scoreLevel ?? ScoreLevel.MIDDLE);
  protected readonly canListen = computed(() => (this.store.state()?.devices ?? []).some((d) => d.micAvailable));

  /** The choice shows at once; if the server refuses, it goes back. */
  protected async choose(which: 'mode', value: ScoreMode): Promise<void>;
  protected async choose(which: 'level', value: ScoreLevel): Promise<void>;
  protected async choose(which: 'mode' | 'level', value: ScoreMode | ScoreLevel): Promise<void> {
    const pending = which === 'mode' ? this.pendingMode : this.pendingLevel;
    (pending as ReturnType<typeof signal<number | undefined>>).set(value);
    try {
      await this.session.updateUserSettings(which === 'mode' ? { scoreMode: value as ScoreMode } : { scoreLevel: value as ScoreLevel });
    } catch {
      this.toast.show('Could not change the score setting. Try again.', 'error');
      this.showCurrent(which);
    } finally {
      // what the server says now (through the state) takes over from the choice made here
      (pending as ReturnType<typeof signal<number | undefined>>).set(undefined);
    }
  }

  /** A radio the user clicked stays checked in the page even if the choice was refused; put it right. */
  private showCurrent(which: 'mode' | 'level'): void {
    const current = which === 'mode' ? this.store.state()?.settings?.scoreMode ?? ScoreMode.RANDOM : this.store.state()?.settings?.scoreLevel ?? ScoreLevel.MIDDLE;
    for (const radio of Array.from(this.host.nativeElement.querySelectorAll<HTMLInputElement>(`input[name="${which}"]`))) {
      radio.checked = Number(radio.value) === current;
    }
  }
}
