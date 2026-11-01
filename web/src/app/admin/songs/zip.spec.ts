/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { extractSongs, ZipEntry } from './zip';

// built with the global Uint8Array: in the jsdom test realm TextEncoder's arrays are another class, which fflate does not recognise
const enc = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));

function zipOf(files: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]>): File {
  return new File([zipSync(files as never) as BlobPart], 'songs.zip');
}

async function all(file: Blob, limits?: Parameters<typeof extractSongs>[1]): Promise<ZipEntry[]> {
  const out: ZipEntry[] = [];
  for await (const e of extractSongs(file, limits)) out.push(e);
  return out;
}

describe('extractSongs', () => {
  it('yields only .kar and .karmp3 files, from any folder, by their base name', async () => {
    const file = zipOf({
      'a/01 - x.kar': enc('MThd one'),
      'b.txt': enc('not a song'),
      'c.KARMP3': enc('zip two'),
      'deep/er/d.Kar': enc('MThd three'),
      'notes.kar.txt': enc('still not'),
      'folder/': new Uint8Array(0),
    });
    const entries = await all(file);
    expect(entries.map((e) => e.name)).toEqual(['01 - x.kar', 'c.KARMP3', 'd.Kar']);
    expect(String.fromCharCode(...entries[0].bytes)).toBe('MThd one');
    expect(String.fromCharCode(...entries[1].bytes)).toBe('zip two');
  });

  it('reads stored and deflated entries alike', async () => {
    const file = zipOf({ 'a.kar': [enc('stored '.repeat(50)), { level: 0 }], 'b.kar': [enc('deflated '.repeat(50)), { level: 6 }] });
    const entries = await all(file);
    expect(String.fromCharCode(...entries[0].bytes)).toBe('stored '.repeat(50));
    expect(String.fromCharCode(...entries[1].bytes)).toBe('deflated '.repeat(50));
  });

  it('stops with an error after too many entries, counting every entry in the archive', async () => {
    const file = zipOf({ 'a.kar': enc('1'), 'b.txt': enc('2'), 'c.kar': enc('3') });
    await expect(all(file, { maxEntries: 2 })).rejects.toThrow(/more than 2 files/i);
  });

  it('the default limit is 10,000 entries and 2 GB', async () => {
    const { MAX_ENTRIES, MAX_BYTES } = await import('./zip');
    expect(MAX_ENTRIES).toBe(10_000);
    expect(MAX_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });

  it('stops with an error when the songs inside are too large altogether', async () => {
    const file = zipOf({ 'a.kar': [enc('x'.repeat(600)), { level: 0 }], 'b.kar': [enc('y'.repeat(600)), { level: 0 }] });
    await expect(all(file, { maxBytes: 1000 })).rejects.toThrow(/too large/i);
  });

  it('regression: a song bigger than the per-song limit is not kept in memory; it is reported as too large and the rest goes on', async () => {
    const big = Uint8Array.from({ length: 300_000 }, () => 97); // packs to almost nothing
    const file = zipOf({ 'huge.kar': [big, { level: 6 }], 'small.kar': enc('MThd small') });
    const entries = await all(file, { maxEntryBytes: 1000, chunkSize: 4096 });
    expect(entries.map((e) => e.name)).toEqual(['huge.kar', 'small.kar']);
    expect(entries[0].tooLarge).toBe(true);
    expect(entries[0].bytes.length).toBe(0);
    expect(entries[1].tooLarge).toBeUndefined();
    expect(String.fromCharCode(...entries[1].bytes)).toBe('MThd small');
  });

  it('a song exactly at the per-song limit is fine', async () => {
    const file = zipOf({ 'edge.kar': [enc('x'.repeat(1000)), { level: 0 }] });
    const entries = await all(file, { maxEntryBytes: 1000 });
    expect(entries[0].tooLarge).toBeUndefined();
    expect(entries[0].bytes.length).toBe(1000);
  });

  it('works when the archive arrives in small pieces', async () => {
    const file = zipOf({ 'a.kar': [enc('a'.repeat(5000)), { level: 6 }], 'b.kar': [enc('b'.repeat(5000)), { level: 0 }] });
    const entries = await all(file, { chunkSize: 37 });
    expect(entries.map((e) => e.bytes.length)).toEqual([5000, 5000]);
  });

  it('does not read the whole archive before it hands over the first song', async () => {
    const file = zipOf({
      'a.kar': [enc('a'.repeat(4000)), { level: 0 }],
      'b.kar': [enc('b'.repeat(4000)), { level: 0 }],
      'c.kar': [enc('c'.repeat(4000)), { level: 0 }],
    });
    const slice = vi.spyOn(file, 'slice');
    const it = extractSongs(file, { chunkSize: 512 })[Symbol.asyncIterator]();
    const first = await it.next();
    expect(first.value?.name).toBe('a.kar');
    const readSoFar = slice.mock.calls.length;
    expect(readSoFar).toBeLessThan(Math.ceil(file.size / 512) - 5);
    await it.return?.(undefined);
  });

  it('an archive with damaged data is an error', async () => {
    const good = zipSync({ 'a.kar': [enc('some words to sing '.repeat(200)), { level: 6 }] } as never);
    const damaged = good.slice();
    for (let i = 45; i < 70; i++) damaged[i] = 0xff; // inside the compressed data
    await expect(all(new File([damaged as BlobPart], 'bad.zip'))).rejects.toBeInstanceOf(Error);
  });

  it('regression: an archive that stops in the middle of a song is an error, not a silently shorter list', async () => {
    const good = zipSync({ 'a.kar': [enc('some words to sing '.repeat(200)), { level: 0 }], 'b.kar': [enc('more words '.repeat(200)), { level: 0 }] } as never);
    const cut = new File([good.slice(0, Math.floor(good.length / 2)) as BlobPart], 'cut.zip');
    await expect(all(cut)).rejects.toThrow(/damaged or incomplete/i);
  });

  it('a file that is not a ZIP gives no songs', async () => {
    expect(await all(new File([enc('hello, this is plain text, not an archive at all') as BlobPart], 'x.zip'))).toEqual([]);
  });

  it('an empty archive gives no songs', async () => {
    expect(await all(new File([zipSync({}) as BlobPart], 'empty.zip'))).toEqual([]);
  });

  it('regression: an entry that claims ZIP64 sizes but has no ZIP64 field is refused, not looped on (fflate before 0.8.3 never returned: GHSA-px8p-9vwx-vf98)', async () => {
    // a hang cannot be timed out in the page, so a fflate that is too old fails here first
    const installed = (JSON.parse(readFileSync('node_modules/fflate/package.json', 'utf8')) as { version: string }).version;
    const [major, minor, patch] = installed.split('.').map(Number);
    expect(major * 1e6 + minor * 1e3 + patch, `fflate ${installed} is too old`).toBeGreaterThanOrEqual(8003);
    const name = 'a.kar';
    const header = new Uint8Array(30 + name.length + 16);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header
    view.setUint16(4, 20, true); // version needed
    view.setUint32(18, 0xffffffff, true); // compressed size: the ZIP64 marker ...
    view.setUint32(22, 0xffffffff, true);
    view.setUint16(26, name.length, true);
    // ... and no extra field (length 0), so there is no ZIP64 field to read the real size from
    header.set(enc(name), 30);
    header.fill(0x78, 30 + name.length);
    await expect(all(new File([header as BlobPart], 'crafted.zip'))).rejects.toThrow(/damaged or incomplete/i);
  });
});
