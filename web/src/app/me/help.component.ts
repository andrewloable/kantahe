import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHORTCUTS } from '../core/shortcuts';

/** Me > Help: the short version of the user guide, in the app. Plain text; the full guide is on the project site. */
@Component({
  selector: 'app-help',
  imports: [RouterLink],
  template: `
    <h2>Help</h2>

    <section>
      <h3>Finding songs</h3>
      <p>Open the Library. Type part of a title or an artist in the search box, or choose MP3 or MIDI to narrow the list.</p>
      <p>
        Know the number of a song? Open the Number tab and tap its digits, as in a karaoke bar. Press a song to add it to your queue.
        The ⋯ button of a song has <strong>Play next</strong> (it sings right after the current song) and <strong>Add to a playlist</strong>.
        The star makes it a favourite.
      </p>
    </section>

    <section>
      <h3>The queue and Play here</h3>
      <p>
        The queue is yours alone, and the same on all your devices. Open <a data-inline-link routerLink="/queue">Queue</a> to see what plays now and what
        comes next, to move a song to the top or to remove it.
      </p>
      <p>
        Only one of your devices plays at a time; the others are remotes. To sing on the device in your hand, open Queue and press
        <strong>Play here</strong>. When the queue is empty a random song plays until you add songs.
      </p>
    </section>

    <section>
      <h3>The player buttons and the vocals</h3>
      <p>
        <a data-inline-link routerLink="/player">Player</a> shows the lyrics, with Play or Pause, Skip and the volume. While a song plays the buttons fade;
        touch the screen or press a key to bring them back. Volume down and up change the volume of this device.
      </p>
      <p>Some songs have a separate vocals track. A <strong>Vocals</strong> button then plays the singer's voice as a guide. It starts off.</p>
    </section>

    <section>
      <h3>What MP3, MIDI, W, L and V mean</h3>
      <p>
        <strong>MP3</strong> songs are recordings. <strong>MIDI</strong> songs are notes that your device turns into sound. A small
        <strong>W</strong> says the words are timed word by word, an <strong>L</strong> that they are timed line by line, and a
        <strong>V</strong> that the song has a separate vocals track.
      </p>
    </section>

    <section>
      <h3>Devices and TVs</h3>
      <p>
        <a data-inline-link routerLink="/me/devices">Me › Devices</a> lists every browser and app you are signed in on, with its settings and a way to
        sign it out.
      </p>
      <p>
        A TV shows a code instead of asking for a password. On your phone or computer, choose <a data-inline-link routerLink="/me/approve-tv">Approve a TV</a>
        and enter the code.
      </p>
    </section>

    <section>
      <h3>Installing the app</h3>
      <p>
        You can put Kantahe on the home screen of your phone. On Android a bar at the top offers <strong>Install</strong>, and so does
        <strong>Install the app</strong> in the Me menu; the browser's menu has <strong>Install app</strong> (or
        <strong>Add to Home screen</strong>) too. On an iPhone, press <strong>How to</strong> in the bar, or open the page in Safari, press
        the Share button and choose <strong>Add to Home Screen</strong>. The page must be opened with https://.
      </p>
    </section>

    <section>
      <h3>Songs kept on this device</h3>
      <p>
        A screen that plays songs keeps the ones it has played, so the next play starts at once. The oldest are removed first, and room is
        always left for other apps. <a data-inline-link routerLink="/me/devices">Me › Devices</a> shows what is kept, and can turn it off or clear it.
      </p>
      <p>A browser that opens the server through a plain http address cannot keep songs; the phone and TV apps can.</p>
    </section>

    <section>
      <h3>Keyboard shortcuts</h3>
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
}
