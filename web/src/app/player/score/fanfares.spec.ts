import { TestBed } from '@angular/core/testing';
import { ServerUrl } from '../../core/server-url';
import { FANFARE_FETCH, FanfareFetch, Fanfares } from './fanfares';

/** A fetch that answers when told to; object URLs are numbered, and the revoked ones are listed. */
function rig() {
  const asked: string[] = [];
  const pending = new Map<string, { ok: () => void; fail: () => void }>();
  const revoked: string[] = [];
  let made = 0;
  let base = 'https://k.example';
  const env: FanfareFetch = {
    fetch: (url) =>
      new Promise<Response>((resolve, reject) => {
        asked.push(url);
        pending.set(url, { ok: () => resolve(new Response(new Blob(['mp3']))), fail: () => reject(new Error('offline')) });
      }),
    createObjectURL: () => `blob:fanfare-${++made}`,
    revokeObjectURL: (url) => revoked.push(url),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: FANFARE_FETCH, useValue: env },
      { provide: ServerUrl, useValue: { base: () => base } },
    ],
  });
  const fanfares = TestBed.inject(Fanfares);
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const answer = async (url: string, ok = true) => {
    const p = pending.get(url)!;
    pending.delete(url);
    if (ok) p.ok();
    else p.fail();
    await settle();
  };
  return { fanfares, asked, revoked, answer, settle, setBase: (b: string) => (base = b) };
}

describe('Fanfares (kantahe-cnf.1)', () => {
  it('fetches the three fanfares once; a second prefetch fetches nothing more', async () => {
    const { fanfares, asked, answer } = rig();
    fanfares.prefetch();
    expect(asked).toEqual(['https://k.example/media/fanfare/1.mp3', 'https://k.example/media/fanfare/2.mp3', 'https://k.example/media/fanfare/3.mp3']);
    for (const url of [...asked]) await answer(url);
    fanfares.prefetch();
    expect(asked).toHaveLength(3);
  });

  it('a fanfare kept on the device is played from it; before that, or after a failed fetch, from the server', async () => {
    const { fanfares, answer } = rig();
    expect(fanfares.url(2)).toBe('https://k.example/media/fanfare/2.mp3');
    fanfares.prefetch();
    expect(fanfares.url(2)).toBe('https://k.example/media/fanfare/2.mp3'); // still being fetched
    await answer('https://k.example/media/fanfare/1.mp3');
    await answer('https://k.example/media/fanfare/2.mp3');
    await answer('https://k.example/media/fanfare/3.mp3', false);
    expect(fanfares.url(1)).toMatch(/^blob:fanfare-/);
    expect(fanfares.url(2)).toMatch(/^blob:fanfare-/);
    expect(fanfares.url(3)).toBe('https://k.example/media/fanfare/3.mp3');
  });

  it('a failed fanfare does not stop the others, and the next prefetch asks again only for it', async () => {
    const { fanfares, asked, answer } = rig();
    fanfares.prefetch();
    await answer('https://k.example/media/fanfare/1.mp3', false);
    await answer('https://k.example/media/fanfare/2.mp3');
    await answer('https://k.example/media/fanfare/3.mp3');
    fanfares.prefetch();
    expect(asked.slice(3)).toEqual(['https://k.example/media/fanfare/1.mp3']);
  });

  it('a fetch still under way is not asked for twice', async () => {
    const { fanfares, asked } = rig();
    fanfares.prefetch();
    fanfares.prefetch();
    expect(asked).toHaveLength(3);
  });

  it('another server: the old files are let go and the new server is asked', async () => {
    const { fanfares, asked, answer, revoked, setBase } = rig();
    fanfares.prefetch();
    for (const url of [...asked]) await answer(url);
    const old = [1, 2, 3].map((t) => fanfares.url(t));
    setBase('https://other.example');
    expect(fanfares.url(1)).toBe('https://other.example/media/fanfare/1.mp3'); // never the old server's file
    fanfares.prefetch();
    expect(revoked).toEqual(old);
    expect(asked.slice(3)).toEqual([1, 2, 3].map((t) => `https://other.example/media/fanfare/${t}.mp3`));
  });

  it('an answer from the old server that arrives after the switch is let go, not kept', async () => {
    const { fanfares, answer, revoked, setBase } = rig();
    fanfares.prefetch();
    setBase('https://other.example');
    fanfares.prefetch();
    await answer('https://k.example/media/fanfare/1.mp3');
    expect(fanfares.url(1)).toBe('https://other.example/media/fanfare/1.mp3');
    expect(revoked).toHaveLength(1);
  });
});
