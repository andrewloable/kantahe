import { Directive, ElementRef, inject } from '@angular/core';

/**
 * A video that never has sound (the background videos are picture only): muted, at volume 0 and without controls from the moment it
 * is made, and again whenever the browser reports a change of volume. It is set at once, not on an event: a browser fires
 * "volumechange" later, and until then a video made with only a muted attribute would not be muted.
 */
@Directive({ selector: 'video[appSilent]', host: { '(volumechange)': 'silence()' } })
export class SilentVideoDirective {
  private readonly el = inject<ElementRef<HTMLVideoElement>>(ElementRef).nativeElement;

  constructor() {
    this.silence();
  }

  silence(): void {
    const el = this.el;
    if (!el.muted) el.muted = true;
    if (!el.defaultMuted) el.defaultMuted = true;
    if (el.volume !== 0) el.volume = 0;
    el.removeAttribute('controls');
  }
}
