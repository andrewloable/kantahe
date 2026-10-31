import { isLoud, LOUD_RMS, MicEnv, MicMeter, rms } from './mic';

function sine(amplitude: number, n = 2048, cycles = 16): Float32Array {
  return Float32Array.from({ length: n }, (_, k) => amplitude * Math.sin((2 * Math.PI * cycles * k) / n));
}

describe('rms', () => {
  it('a sine of amplitude 0.1 is about 0.0707', () => {
    expect(rms(sine(0.1))).toBeCloseTo(0.0707, 3);
  });
  it('silence is 0, and an empty buffer is 0', () => {
    expect(rms(new Float32Array(2048))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe('isLoud', () => {
  it('is louder than 0.02', () => {
    expect(LOUD_RMS).toBe(0.02);
    expect(isLoud(rms(sine(0.1)))).toBe(true);
    expect(isLoud(rms(new Float32Array(2048)))).toBe(false);
    expect(isLoud(0.02)).toBe(false);
    expect(isLoud(0.0201)).toBe(true);
    expect(isLoud(rms(sine(0.025)))).toBe(false); // about 0.0177
  });
});

function env(over: Partial<MicEnv> = {}, level = { amplitude: 0.1 }, context = { state: 'running', resume: vi.fn().mockResolvedValue(undefined) }) {
  const stopped = vi.fn();
  const closed = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopped }] });
  const e: MicEnv = {
    secure: true,
    getUserMedia,
    createContext: () =>
      ({
        get state() {
          return context.state;
        },
        resume: context.resume,
        createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
        createAnalyser: () => ({
          fftSize: 0,
          getFloatTimeDomainData: (buf: Float32Array) => buf.set(sine(level.amplitude, buf.length)),
        }),
        close: closed,
      }) as never,
    ...over,
  };
  return { e, getUserMedia, stopped, closed, level, context };
}

describe('MicMeter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('without a secure context there is no microphone and it is not even asked for', async () => {
    const { e, getUserMedia } = env({ secure: false });
    expect(await new MicMeter(e).init()).toBe(false);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('a browser without getUserMedia has none', async () => {
    const { e } = env({ getUserMedia: undefined });
    expect(await new MicMeter(e).init()).toBe(false);
  });

  it('a refused permission means no microphone', async () => {
    const { e } = env({ getUserMedia: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')) });
    const mic = new MicMeter(e);
    expect(await mic.init()).toBe(false);
    expect(mic.available).toBe(false);
  });

  it('capable() tells whether a microphone could be used, without asking for it', () => {
    const a = env();
    expect(new MicMeter(a.e).capable()).toBe(true);
    expect(a.getUserMedia).not.toHaveBeenCalled();
    expect(new MicMeter(env({ secure: false }).e).capable()).toBe(false);
    expect(new MicMeter(env({ getUserMedia: undefined }).e).capable()).toBe(false);
  });

  it('asks for audio only, once', async () => {
    const { e, getUserMedia } = env();
    const mic = new MicMeter(e);
    expect(await mic.init()).toBe(true);
    expect(await mic.init()).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mic.available).toBe(true);
  });

  it('counts a loud reading every 100 ms between begin and end', async () => {
    const { e } = env();
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    vi.advanceTimersByTime(1000);
    expect(mic.end()).toBe(10);
    vi.advanceTimersByTime(1000);
    expect(mic.end()).toBe(10); // nothing counted after end
  });

  it('quiet readings are not counted', async () => {
    const { e, level } = env({}, { amplitude: 0 });
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    vi.advanceTimersByTime(1000);
    level.amplitude = 0.1;
    vi.advanceTimersByTime(300);
    expect(mic.end()).toBe(3);
  });

  it('every song starts at zero', async () => {
    const { e } = env();
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    vi.advanceTimersByTime(500);
    expect(mic.end()).toBe(5);
    mic.begin();
    vi.advanceTimersByTime(200);
    expect(mic.end()).toBe(2);
  });

  it('counts nothing without a microphone', async () => {
    const { e } = env({ secure: false });
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    vi.advanceTimersByTime(1000);
    expect(mic.end()).toBe(0);
  });

  it('dispose stops the stream and the counting', async () => {
    const { e, stopped, closed } = env();
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    mic.dispose();
    expect(stopped).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(mic.end()).toBe(0);
  });

  it('regression: wakes up the microphone context while it is asleep (the browser starts it asleep until the page was used)', async () => {
    const asleep = { state: 'suspended', resume: vi.fn().mockResolvedValue(undefined) };
    const { e } = env({}, { amplitude: 0.1 }, asleep);
    const mic = new MicMeter(e);
    await mic.init();
    mic.begin();
    vi.advanceTimersByTime(300);
    expect(asleep.resume).toHaveBeenCalled();
    asleep.resume.mockClear();
    asleep.state = 'running';
    vi.advanceTimersByTime(300);
    expect(asleep.resume).not.toHaveBeenCalled();
  });

  it('regression: after dispose the microphone can be asked for again', async () => {
    const { e, getUserMedia } = env();
    const mic = new MicMeter(e);
    expect(await mic.init()).toBe(true);
    mic.dispose();
    expect(mic.available).toBeUndefined();
    expect(await mic.init()).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});
