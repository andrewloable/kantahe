import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SilentVideoDirective } from './silent-video.directive';

@Component({ imports: [SilentVideoDirective], template: '<video appSilent controls></video>' })
class Host {}

describe('SilentVideoDirective', () => {
  it('mutes at volume 0 without controls the moment the element is made, with no event needed', () => {
    const setMuted = vi.spyOn(HTMLMediaElement.prototype, 'muted', 'set');
    const setVolume = vi.spyOn(HTMLMediaElement.prototype, 'volume', 'set');
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const v = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(v.muted).toBe(true);
    expect(v.defaultMuted).toBe(true);
    expect(v.hasAttribute('muted')).toBe(true);
    expect(v.volume).toBe(0);
    expect(v.hasAttribute('controls')).toBe(false);
    expect(setMuted.mock.calls.every(([x]) => x === true)).toBe(true);
    expect(setVolume.mock.calls.every(([x]) => x === 0)).toBe(true);
    vi.restoreAllMocks();
  });

  it('puts it right again when something turns the sound on', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const v = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    v.muted = false;
    v.volume = 1;
    v.setAttribute('controls', '');
    v.dispatchEvent(new Event('volumechange'));
    expect(v.muted).toBe(true);
    expect(v.volume).toBe(0);
    expect(v.hasAttribute('controls')).toBe(false);
  });
});
