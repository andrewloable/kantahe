import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { AuthStore } from '../core/auth.store';
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

  // kantahe-cqc.9: every section can be linked to (the pages link to the section that explains them), and administrators have one of their own
  it('regression: every section has an id the pages link to', () => {
    const el = render();
    expect(Array.from(el.querySelectorAll('section')).map((sec) => sec.id)).toEqual(['finding-songs', 'queue', 'player', 'badges', 'devices', 'install', 'cached', 'shortcuts']);
  });

  it('regression: an administrator also has the section For administrators, with uploading, the song list and users', () => {
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: true }) }));
    const el = render();
    const admin = el.querySelector('section#admin')!;
    expect(admin.querySelector('h3')?.textContent?.trim()).toBe('For administrators');
    expect(admin.textContent).toContain('ZIP');
    expect(admin.textContent).toContain('Delete files too');
    expect(admin.textContent).toContain('temporary password');
  });

  it('a user who is not an administrator has no such section', () => {
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { admin: false }) }));
    expect(render().querySelector('section#admin')).toBeNull();
  });

  it('says that the vocals may start by themselves in amateur singer mode, and that the singer can switch them off', () => {
    const section = Array.from(render().querySelectorAll('section')).find((s) => s.querySelector('h3')?.textContent?.includes('vocals'))!;
    const text = section.textContent ?? '';
    expect(text).toContain('amateur singer mode');
    expect(text).toContain('first two lines');
    expect(text).toContain('switch');
  });

  it('says that the volume and the vocals are changed on the Queue page, not on the player', () => {
    const section = Array.from(render().querySelectorAll('section')).find((s) => s.querySelector('h3')?.textContent?.includes('vocals'))!;
    expect(section.textContent).toContain('no volume or vocals buttons');
    expect(section.textContent).toContain('Slower');
    expect(section.querySelector('a[href="/queue"]')).not.toBeNull();
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
