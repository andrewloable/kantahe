import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { NumberPadComponent } from './number-pad.component';
import { fakeLibrary, FakeLibrary, song, untilAborted } from './testing';

function setup(h: FakeLibrary = {}) {
  const f = fakeLibrary({ getSong: (r) => song(r.number, 'Hello', 'Adele', Format.MP3), ...h });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
  const fixture = TestBed.createComponent(NumberPadComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const key = (label: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!;
  const press = (...labels: string[]) => {
    labels.forEach((l) => key(l).click());
    fixture.detectChanges();
  };
  const add = () => el.querySelector<HTMLButtonElement>('button.add')!;
  const settle = async (ms = 200) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  return { fixture, el, key, press, add, settle, ...f };
}

describe('NumberPadComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has a key for every digit, backspace and clear, each with a label', () => {
    const { key } = setup();
    for (const d of '0123456789') expect(key(d), d).toBeDefined();
    expect(key('Backspace')).toBeDefined();
    expect(key('Clear')).toBeDefined();
  });

  it('looks the number up once, 150 ms after the last key, and shows the song', async () => {
    const { press, settle, calls, el, add } = setup();
    press('0', '1', '0', '5', '2');
    await settle(149);
    expect(calls.get.length).toBe(0);
    await settle(2);
    expect(calls.get.map((c) => c.number)).toEqual(['01052']);
    expect(el.textContent).toContain('01052');
    expect(el.textContent).toContain('Hello');
    expect(el.textContent).toContain('Adele');
    expect(el.textContent).toContain('MP3');
    expect(add().disabled).toBe(false);
  });

  it('Add queues the song and clears the pad', async () => {
    const { press, settle, calls, add, el } = setup();
    press('0', '1', '0', '5', '2');
    await settle();
    add().click();
    await settle(10);
    expect(calls.add.map((c) => c.number)).toEqual(['01052']);
    expect(el.querySelector('output')?.textContent?.trim()).toBe('');
    expect(add().disabled).toBe(true);
  });

  it('Add is off until a song is found', async () => {
    const { press, settle, add } = setup();
    expect(add().disabled).toBe(true);
    press('1');
    expect(add().disabled).toBe(true); // still looking
    await settle();
    expect(add().disabled).toBe(false);
  });

  it('an unknown number says so and keeps Add off', async () => {
    const { press, settle, add, el } = setup({
      getSong: () => {
        throw new ConnectError('not found', Code.NotFound);
      },
    });
    press('9', '9');
    await settle();
    expect(el.textContent).toContain('No song with this number');
    expect(add().disabled).toBe(true);
  });

  it('another failure is reported as such, not as an unknown number', async () => {
    const { press, settle, el } = setup({
      getSong: () => {
        throw new ConnectError('down', Code.Unavailable);
      },
    });
    press('1');
    await settle();
    expect(el.textContent).not.toContain('No song with this number');
    expect(el.textContent).toMatch(/could not reach the server/i);
  });

  it('backspace and clear', async () => {
    const { press, settle, el, calls } = setup();
    press('1', '2', '3', 'Backspace');
    expect(el.querySelector('output')?.textContent?.trim()).toBe('12');
    press('Clear');
    expect(el.querySelector('output')?.textContent?.trim()).toBe('');
    await settle();
    expect(calls.get.length).toBe(0); // nothing typed, nothing to look up
  });

  it('an old answer does not replace the answer for what is typed now', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { press, settle, el } = setup({
      getSong: async (r) => {
        if (r.number === '1') await gate;
        return song(r.number, r.number === '1' ? 'One' : 'Twelve', 'A');
      },
    });
    press('1');
    await settle(); // the lookup for 1 is waiting
    press('2');
    await settle(); // the lookup for 12 is done
    expect(el.textContent).toContain('Twelve');
    release();
    await settle(10);
    expect(el.textContent).toContain('Twelve');
    expect(el.textContent).not.toContain('One');
  });

  it('the physical keyboard works too', async () => {
    const { fixture, settle, el, calls, add } = setup();
    const press = (key: string) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
    };
    press('4');
    press('2');
    press('x'); // ignored
    expect(el.querySelector('output')?.textContent?.trim()).toBe('42');
    press('Backspace');
    expect(el.querySelector('output')?.textContent?.trim()).toBe('4');
    await settle();
    expect(calls.get.map((c) => c.number)).toEqual(['4']);
    press('Enter');
    await settle(10);
    expect(calls.add.map((c) => c.number)).toEqual(['4']);
    press('7');
    press('Escape');
    expect(el.querySelector('output')?.textContent?.trim()).toBe('');
    expect(add().disabled).toBe(true);
  });

  it('keys typed into a text field elsewhere are not taken', () => {
    const { el } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
    expect(el.querySelector('output')?.textContent?.trim()).toBe('');
    input.remove();
  });

  it('stops at 20 digits', () => {
    const { press, el } = setup();
    for (let i = 0; i < 25; i++) press('1');
    expect(el.querySelector('output')?.textContent?.trim().length).toBe(20);
  });

  it('shows the typed digits to screen readers', () => {
    const { el, press } = setup();
    press('7');
    const out = el.querySelector('output')!;
    expect(out.getAttribute('aria-live')).toBe('polite');
  });

  it('regression: typing on abandons the lookup that is still running', async () => {
    const aborted: string[] = [];
    const { press, settle } = setup({
      getSong: async (r, signal) => {
        if (r.number === '1') {
          try {
            await untilAborted(signal);
          } catch (e) {
            aborted.push(r.number);
            throw e;
          }
        }
        return song(r.number, 'T', 'A');
      },
    });
    press('1');
    await settle(); // the lookup for 1 is waiting
    press('2');
    await settle();
    expect(aborted).toEqual(['1']);
  });
});
