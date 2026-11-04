import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function render() {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('has the eight sections, each with a heading', () => {
    const el = render();
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Help');
    expect(Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim())).toEqual([
      'Finding songs',
      'The queue and Play here',
      'The player buttons and the vocals',
      'What MP3, MIDI, W, L and V mean',
      'Devices and TVs',
      'Installing the app',
      'Songs kept on this device',
      'Keyboard shortcuts',
    ]);
  });

  it('lists the keyboard shortcuts and says that they can be turned off', () => {
    const section = Array.from(render().querySelectorAll('section')).pop()!;
    expect(Array.from(section.querySelectorAll('table kbd')).map((k) => k.textContent)).toEqual(['Space or K', 'N', 'F', '+ and −', 'V', '/', '?']);
    expect(section.textContent).toContain('Appearance and account');
  });

  it('says what the badges mean and ends with the address of the full guide', () => {
    const el = render();
    const badges = Array.from(el.querySelectorAll('section'))[3].textContent ?? '';
    for (const part of ['MP3', 'MIDI', 'word by word', 'line by line', 'separate vocals']) expect(badges).toContain(part);
    const link = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('kantahe.party'));
    expect(link?.getAttribute('href')).toBe('https://kantahe.party');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('regression: says that a plain http address cannot keep songs (the switch is then not in Me > Devices)', () => {
    const last = Array.from(render().querySelectorAll('section'))[6].textContent ?? '';
    expect(last).toContain('plain http');
    expect(last).toContain('cannot keep songs');
  });

  it('names no other product', () => {
    const text = render().textContent ?? '';
    for (const other of ['Plex', 'Jellyfin', 'Emby', 'Kodi', 'Spotify']) expect(text).not.toContain(other);
  });
});
