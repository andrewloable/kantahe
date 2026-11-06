import { strToU8, zipSync } from 'fflate';

/** n silent MPEG-1 Layer III frames (44.1 kHz, 128 kbps, stereo): 417 bytes each; 2000 frames play for about a minute. */
function mp3(frames: number): Uint8Array {
  const out = new Uint8Array(417 * frames);
  for (let i = 0; i < frames; i++) out.set([0xff, 0xfb, 0x90, 0x00], i * 417);
  return out;
}

export interface KarMp3Options {
  /** The file carries the singer's voice as a second MP3 (Kantahe Maker 1.1). */
  vocals?: boolean;
  /** How the .nfo says the lyrics are timed (Kantahe Maker 1.2.6); the default is word. */
  timing?: 'word' | 'line';
  /** The .lrc text; the default is one line at 00:01. */
  lrc?: string;
}

/** A small .karmp3 (a ZIP of a silent MP3, an .lrc and an .nfo) with the given title, for a test that needs a file of its own. */
export function karmp3(title: string, frames = 300, opts: KarMp3Options = {}): Buffer {
  const base = `00800 - Band - ${title}`;
  const vocals = opts.vocals
    ? `Instrumental : ${base}.mp3\nVocals : ${base}.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n`
    : '';
  const entries: Record<string, Uint8Array> = {
    [`${base}.mp3`]: mp3(frames),
    [`${base}.lrc`]: strToU8(opts.lrc ?? '[00:01.00]<00:01.00>Sing <00:01.50>along'),
    [`${base}.nfo`]: strToU8(`Title : ${title}\nArtist : Band\n${vocals}Timing by : ${opts.timing ?? 'word'}\n`),
  };
  if (opts.vocals) entries[`${base}.vocals.mp3`] = mp3(Math.max(frames - 20, 1));
  return Buffer.from(zipSync(entries));
}
