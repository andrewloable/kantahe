import { afterNextRender, Component, computed, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { SHORTCUTS } from '../core/shortcuts';

/** Me > Help: the short version of the user guide, in the app. Plain text; the full guide is on the project site. */
@Component({
  selector: 'app-help',
  imports: [RouterLink],
  template: `
    <h2>Help</h2>

    <section id="finding-songs" aria-labelledby="help-finding-songs">
      <h3 id="help-finding-songs" tabindex="-1">Finding songs</h3>
      <p>Open the Library. Type part of a title or an artist in the search box, or choose MP3 or MIDI to narrow the list.</p>
      <p>
        Know the number of a song? Open the Number tab and tap its digits, as in a karaoke bar. Press a song to add it to your queue.
        The ⋯ button of a song has <strong>Play next</strong> (it sings right after the current song) and <strong>Add to a playlist</strong>.
        The star makes it a favourite.
      </p>
    </section>

    <section id="queue" aria-labelledby="help-queue">
      <h3 id="help-queue" tabindex="-1">The queue and Play here</h3>
      <p>
        The queue is yours alone, and the same on all your devices. Open <a data-inline-link routerLink="/queue">Queue</a> to see what plays now and what
        comes next; the <strong>⋯</strong> button of a song moves it to the top or removes it. A song is in the queue only once.
      </p>
      <p>
        Only one of your devices plays at a time; the others are remotes. To sing on the device in your hand, open Queue and press
        <strong>Play here</strong>. When the queue is empty a random song plays until you add songs.
      </p>
    </section>

    <section id="player" aria-labelledby="help-player">
      <h3 id="help-player" tabindex="-1">The player buttons and the vocals</h3>
      <p>
        <a data-inline-link routerLink="/player">Player</a> shows the lyrics, with Play or Pause and Skip. While a song plays the buttons fade; touch the
        screen or press a key to bring them back. The player has no volume or vocals buttons, so that nothing moves on the screen while you sing: change
        the volume and the vocals on the <a data-inline-link routerLink="/queue">Queue</a> page of any device, even the one that plays, with
        <strong>Volume and tempo</strong> next to Play and Skip.
      </p>
      <p>
        Some songs have a separate vocals track. On the Queue page, <strong>Vocals</strong> then plays the singer's voice as a guide, with
        <strong>Vocals quieter</strong> and <strong>Vocals louder</strong> beside it. It starts off. <strong>Slower</strong> and <strong>Faster</strong> there
        change the speed of the song without changing the pitch, and <strong>Normal speed</strong> puts it back; the next song starts at normal speed.
      </p>
      <p>
        If the administrator has switched on <strong>amateur singer mode</strong>, the voice plays by itself during the first two lines of the lyrics of
        such a song and fades out when the third line starts, to help you with a song you do not know. The Queue page shows it as on. You can switch it
        off whenever you like; it starts again with the next song.
      </p>
    </section>

    <section id="badges" aria-labelledby="help-badges">
      <h3 id="help-badges" tabindex="-1">What MP3, MIDI, W, L and V mean</h3>
      <p>
        <strong>MP3</strong> songs are recordings. <strong>MIDI</strong> songs are notes that your device turns into sound. A small
        <strong>W</strong> says the words are timed word by word, an <strong>L</strong> that they are timed line by line, and a
        <strong>V</strong> that the song has a separate vocals track.
      </p>
    </section>

    <section id="devices" aria-labelledby="help-devices">
      <h3 id="help-devices" tabindex="-1">Devices and TVs</h3>
      <p>
        <a data-inline-link routerLink="/me/devices">Me › Devices</a> lists every browser and app you are signed in on, with its settings and a way to
        sign it out.
      </p>
      <p>
        A TV shows a code instead of asking for a password. On your phone or computer, choose <a data-inline-link routerLink="/me/approve-tv">Approve a TV</a>
        and enter the code.
      </p>
    </section>

    <section id="install" aria-labelledby="help-install">
      <h3 id="help-install" tabindex="-1">Installing the app</h3>
      <p>
        You can put Kantahe on the home screen of your phone. On Android a bar at the top offers <strong>Install</strong>, and so does
        <strong>Install the app</strong> in the Me menu; the browser's menu has <strong>Install app</strong> (or
        <strong>Add to Home screen</strong>) too. On an iPhone, press <strong>How to</strong> in the bar, or open the page in Safari, press
        the Share button and choose <strong>Add to Home Screen</strong>. The page must be opened with https://.
      </p>
    </section>

    <section id="cached" aria-labelledby="help-cached">
      <h3 id="help-cached" tabindex="-1">Songs kept on this device</h3>
      <p>
        A screen that plays songs keeps the ones it has played, so the next play starts at once. The oldest are removed first, and room is
        always left for other apps. <a data-inline-link routerLink="/me/devices">Me › Devices</a> shows what is kept, and can turn it off or clear it.
      </p>
      <p>A browser that opens the server through a plain http address cannot keep songs; the phone and TV apps can.</p>
    </section>

    <section id="shortcuts" aria-labelledby="help-shortcuts">
      <h3 id="help-shortcuts" tabindex="-1">Keyboard shortcuts</h3>
      <p>On a computer these single keys work. Press <kbd>?</kbd> anywhere to see the list. They never act while you type in a field.</p>
      <table>
        <tbody>
          @for (s of shortcuts; track s.keys) {
            <tr>
              <th scope="row"><kbd>{{ s.keys }}</kbd></th>
              <td>{{ s.does }} <span class="where">({{ s.where }})</span></td>
            </tr>
          }
        </tbody>
      </table>
      <p>To turn them off, clear <strong>Keyboard shortcuts</strong> in <a data-inline-link routerLink="/me/appearance">Me › Appearance and account</a>.</p>
    </section>


    @if (isAdmin()) {
      <section id="admin" aria-labelledby="help-admin">
        <h3 id="help-admin" tabindex="-1">For administrators</h3>
        <p>
          <strong>Uploading.</strong> Admin › Upload takes .kar and .karmp3 files and ZIP files with songs in them (a ZIP is unpacked on this device and
          its songs are sent one by one). A song that is already in the library is reported as a duplicate and not added again. An MP3 song keeps
          the number of its songbook; a MIDI song whose number is taken gets a new one.
        </p>
        <p>
          <strong>The song list.</strong> Admin › Songs: <strong>Edit</strong> changes a title or an artist (your words win over the file's). <strong>Remove from
          list</strong> takes a song off the list and keeps its file; <strong>Delete files too</strong> deletes the file as well. <strong>Check the library</strong>
          finds broken songs (a missing file, a MIDI song without music, a damaged file).
        </p>
        <p>
          <strong>Users.</strong> Admin › Users: a new user gets a <strong>temporary password</strong> and must change it at the first sign-in. The ⋯ button of a
          user resets the password, signs out all their devices (a lost phone), disables or deletes the account.
        </p>
      </section>
    }

    <p class="more">The full guide is on <a data-inline-link href="https://kantahe.party" target="_blank" rel="noopener noreferrer">kantahe.party</a>.</p>
  `,
  styles: `
    section {
      margin: 0 0 1.5rem;
    }
    h3 {
      margin: 0 0 0.25rem;
      font-size: 1.125rem;
    }
    /* a heading takes the focus when a Help link leads to it: no ring for a heading (the page scrolls to it) */
    h3:focus {
      outline: none;
    }
    p {
      margin: 0 0 0.5rem;
    }
    table {
      border-collapse: collapse;
      margin: 0 0 0.5rem;
    }
    th,
    td {
      padding: 0.25rem 0.75rem 0.25rem 0;
      text-align: left;
      vertical-align: top;
    }
    kbd {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--field-line);
      border-radius: 0.35rem;
      font: inherit;
      font-weight: 600;
      white-space: nowrap;
    }
    .where {
      color: var(--muted);
    }
  `,
})
export class HelpComponent {
  protected readonly shortcuts = SHORTCUTS;
  protected readonly isAdmin = computed(() => this.auth.user()?.admin === true);

  constructor() {
    // /me/help#queue (the Help links of the pages, kantahe-cqc.9): that section's heading comes into view and takes the focus
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    if (fragment) {
      const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
      // one frame later: on an in-app navigation the page has its full height only then (scrolling at once stopped short)
      afterNextRender(() =>
        requestAnimationFrame(() => {
          const heading = host.querySelector<HTMLElement>(`#help-${CSS.escape(fragment)}`);
          heading?.scrollIntoView({ block: 'start' });
          heading?.focus({ preventScroll: true });
        }),
      );
    }
  }

  private readonly auth = inject(AuthStore);
}
