import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { ScoreSchema } from '../../../gen/kantahe/v1/session_pb';
import { ServerUrl } from '../../core/server-url';
import { FANFARE_AUDIO, ScoreScreenComponent } from './score-screen.component';

function score(over: Partial<{ number: string; hasValue: boolean; value: number; comment: string; fanfare: number; reason: string; untilMs: bigint }> = {}) {
  return create(ScoreSchema, { number: '21628', hasValue: true, value: 87, comment: 'You are a good singer.', fanfare: 2, untilMs: 10_000n, ...over });
}

function setup() {
  const played: { url: string; audio: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } }[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: FANFARE_AUDIO,
        useValue: (url: string) => {
          const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() };
          played.push({ url, audio });
          return audio;
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ScoreScreenComponent);
  const el = fixture.nativeElement as HTMLElement;
  const show = async (s: ReturnType<typeof score> | undefined) => {
    fixture.componentRef.setInput('score', s);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  };
  const pass = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const number = () => el.querySelector('.number');
  return { fixture, el, played, show, pass, number };
}

describe('ScoreScreenComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows nothing without a score', async () => {
    const { el, show } = setup();
    await show(undefined);
    expect(el.querySelector('.overlay')).toBeNull();
  });

  it('rolls through numbers from 50 to 100 for 1.4 s and then lands on the real value', async () => {
    const { show, pass, number, el, played } = setup();
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0.5);
    await show(score());
    await pass(1399);
    expect(number()?.textContent?.trim()).toBe('75'); // 50 + floor(0.5 * 51)
    expect(el.querySelector('.comment')).toBeNull();
    expect(played).toEqual([]);
    random.mockReturnValue(0.999);
    await pass(1);
    expect(number()?.textContent?.trim()).toBe('87');
    expect(el.querySelector('.comment')?.textContent).toContain('You are a good singer.');
    expect(number()?.classList.contains('t2')).toBe(true);
    expect(played.map((p) => p.url)).toEqual([`${TestBed.inject(ServerUrl).base()}/media/fanfare/2.mp3`]);
    expect(played[0].audio.play).toHaveBeenCalledTimes(1);
  });

  it('every shown value while rolling is between 50 and 100', async () => {
    const { show, pass, number } = setup();
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => ((i++ * 0.137) % 1) as number);
    await show(score());
    const seen = new Set<number>();
    for (let t = 0; t < 1300; t += 55) {
      await pass(55);
      seen.add(Number(number()?.textContent));
    }
    expect(seen.size).toBeGreaterThan(5);
    for (const v of seen) {
      expect(v).toBeGreaterThanOrEqual(50);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('changes the number every 55 ms', async () => {
    const { show, pass, number } = setup();
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    await show(score());
    await pass(55);
    expect(number()?.textContent?.trim()).toBe('50');
    random.mockReturnValue(0.99);
    await pass(54);
    expect(number()?.textContent?.trim()).toBe('50');
    await pass(1);
    expect(number()?.textContent?.trim()).toBe('100');
  });

  it('colours the number by tier and plays the matching fanfare', async () => {
    for (const [fanfare, cls] of [
      [1, 't1'],
      [2, 't2'],
      [3, 't3'],
    ] as const) {
      TestBed.resetTestingModule();
      const { show, pass, number, played } = setup();
      await show(score({ fanfare, value: 70 + fanfare * 10 }));
      await pass(1400);
      expect(number()?.classList.contains(cls), `fanfare ${fanfare}`).toBe(true);
      expect(played.map((p) => p.url)).toEqual([`${TestBed.inject(ServerUrl).base()}/media/fanfare/${fanfare}.mp3`]);
    }
  });

  it('below 70 there is no tier colour and no fanfare', async () => {
    const { show, pass, number, played } = setup();
    await show(score({ value: 62, fanfare: 0, comment: 'You can do better.' }));
    await pass(1400);
    expect(number()?.textContent?.trim()).toBe('62');
    expect(number()?.classList.contains('t1') || number()?.classList.contains('t2') || number()?.classList.contains('t3')).toBe(false);
    expect(played).toEqual([]);
  });

  it('no score this time: dashes, the words, the reason, no rolling and no sound', async () => {
    const { show, pass, number, el, played } = setup();
    await show(score({ hasValue: false, value: 0, fanfare: 0, comment: '', reason: 'The microphone heard too little.' }));
    expect(number()?.textContent?.trim()).toBe('--');
    expect(el.textContent).toContain('No score this time');
    expect(el.textContent).toContain('The microphone heard too little.');
    await pass(5000);
    expect(number()?.textContent?.trim()).toBe('--');
    expect(played).toEqual([]);
  });

  it('regression: the overlay is a modal dialog named Score', async () => {
    const { show, el } = setup();
    await show(score());
    const overlay = el.querySelector('.overlay');
    expect(overlay?.getAttribute('role')).toBe('dialog');
    expect(overlay?.getAttribute('aria-modal')).toBe('true');
    expect(overlay?.getAttribute('aria-label')).toBe('Score');
  });

  it('regression: if the server never clears the score (the connection dropped), the overlay closes by itself 2 s after its time', async () => {
    const { show, pass, el, played } = setup();
    await show(score({ untilMs: 10_000n })); // server time 10 s; this page's clock starts near 0 here
    await pass(1400);
    expect(el.querySelector('.overlay')).not.toBeNull();
    await pass(10_000);
    expect(el.querySelector('.overlay')).not.toBeNull();
    await pass(1200); // 12.6 s in: 2.6 s past the end
    expect(el.querySelector('.overlay')).toBeNull();
    expect(played[0].audio.pause).toHaveBeenCalled();
  });

  it('a score whose time is long past does not show at all', async () => {
    const random = vi.spyOn(Math, 'random');
    const { show, el, played } = setup();
    vi.setSystemTime(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await show(score({ untilMs: 1000n }));
    await vi.advanceTimersByTimeAsync(5000); // long enough for a roll and its fanfare
    expect(el.querySelector('.overlay')).toBeNull();
    expect(played).toEqual([]);
    expect(random).not.toHaveBeenCalled(); // no roll was started
  });

  it('clearing the score closes the overlay and stops the fanfare', async () => {
    const { show, pass, el, played } = setup();
    await show(score());
    await pass(1400);
    await show(undefined);
    expect(el.querySelector('.overlay')).toBeNull();
    expect(played[0].audio.pause).toHaveBeenCalled();
  });

  // The timers are checked by what they would do if they were left running: the roll draws a random number, the land
  // timer starts the fanfare, the close timer ends the overlay. vi.getTimerCount() would also count the timers of
  // anything else that runs in the same page (this suite shares one document and one fake clock with other specs).
  it('clearing the score during the roll stops the roll and plays nothing', async () => {
    const random = vi.spyOn(Math, 'random');
    const { show, pass, played } = setup();
    await show(score());
    await pass(500);
    await show(undefined);
    const draws = random.mock.calls.length;
    await pass(3000);
    expect(played).toEqual([]);
    expect(random.mock.calls.length).toBe(draws);
  });

  it('destroying the component during the roll stops the roll, the landing and the closing', async () => {
    const random = vi.spyOn(Math, 'random');
    const { fixture, show, pass, played } = setup();
    await show(score());
    await pass(500);
    fixture.destroy();
    const draws = random.mock.calls.length;
    await pass(60_000); // far past the landing (1.4 s) and the closing (score end + 2.6 s)
    expect(random.mock.calls.length).toBe(draws); // the roll interval is gone
    expect(played).toEqual([]); // the landing timer is gone
    expect(fixture.componentInstance.open()).toBe(true); // the closing timer is gone: it would have ended the overlay
  });

  it('destroying the component after the landing stops the fanfare and the closing', async () => {
    const { fixture, show, pass, played } = setup();
    await show(score());
    await pass(1400);
    fixture.destroy();
    expect(played[0].audio.pause).toHaveBeenCalled();
    await pass(60_000);
    expect(fixture.componentInstance.open()).toBe(true);
    expect(played.length).toBe(1);
  });

  it('a new score starts a new roll and stops the old fanfare', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // the rolling digits are 50, never the real 95
    const { show, pass, number, played } = setup();
    await show(score());
    await pass(1400);
    await show(score({ number: '3', value: 95, fanfare: 3, comment: 'You are excellent!', untilMs: 20_000n }));
    expect(played[0].audio.pause).toHaveBeenCalled();
    expect(number()?.textContent?.trim()).not.toBe('95');
    await pass(1400);
    expect(number()?.textContent?.trim()).toBe('95');
    expect(played.length).toBe(2);
  });

  it('the same score arriving again (a repeated state) does not roll again or replay the fanfare', async () => {
    const { show, pass, played } = setup();
    await show(score());
    await pass(1400);
    await show(score());
    await pass(2000);
    expect(played.length).toBe(1);
  });

  it('with reduced motion the value is shown at once and the fanfare plays at once', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { show, number, played, el } = setup();
    await show(score());
    expect(number()?.textContent?.trim()).toBe('87');
    expect(el.querySelector('.comment')).not.toBeNull();
    expect(played.length).toBe(1);
  });

  it('a refused fanfare (no tap yet) is not an error', async () => {
    const { show, pass, fixture } = setup();
    void fixture;
    await show(score());
    await expect(pass(1400)).resolves.toBeUndefined();
  });

  it('the result is announced once, when it lands, and the rolling digits are hidden from screen readers', async () => {
    const { show, pass, el, number } = setup();
    await show(score());
    expect(number()?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.announce')?.textContent?.trim() ?? '').toBe('');
    await pass(1400);
    expect(el.querySelector('.announce')?.textContent).toContain('Score 87. You are a good singer.');
    expect(el.querySelector('[aria-live]')).not.toBeNull();
  });
});
