import { create } from '@bufbuild/protobuf';
import { PlaybackKind, PlaybackSchema } from '../../../gen/kantahe/v1/catalog_pb';
import { Engine, mediaUrl } from './engine';
import { Mp3Engine } from './mp3-engine';
import { MidiDeps, MidiEngine } from './midi-engine';

const BASE = 'https://k.example';

describe('mediaUrl', () => {
  it('puts the server in front of a path and leaves a full address alone', () => {
    expect(mediaUrl(BASE, '/media/song/1?exp=1&sig=a')).toBe('https://k.example/media/song/1?exp=1&sig=a');
    expect(mediaUrl(`${BASE}/sing`, '/media/x')).toBe('https://k.example/sing/media/x');
    expect(mediaUrl(BASE, 'https://cdn.example/a.mp3')).toBe('https://cdn.example/a.mp3');
    expect(mediaUrl(BASE, 'media/x')).toBe('https://k.example/media/x');
  });
});

describe('Mp3Engine', () => {
  function setup() {
    const audio = document.createElement('audio');
    audio.play = vi.fn().mockResolvedValue(undefined);
    audio.pause = vi.fn();
    audio.load = vi.fn();
    let time = 0;
    Object.defineProperty(audio, 'currentTime', { get: () => time, set: (v: number) => (time = v), configurable: true });
    const engine = new Mp3Engine(BASE, audio);
    const playback = create(PlaybackSchema, { kind: PlaybackKind.AUDIO, audioUrl: '/media/song/1052?exp=9&sig=zz', ready: true });
    return { audio, engine, playback, setTime: (s: number) => (time = s) };
  }

  it('plays the signed address on the configured server and is loaded when it can play', async () => {
    const { audio, engine, playback } = setup();
    const loaded = engine.load(playback);
    expect(audio.getAttribute('src')).toBe('https://k.example/media/song/1052?exp=9&sig=zz');
    let done = false;
    void loaded.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    audio.dispatchEvent(new Event('canplay'));
    await loaded;
    expect(done).toBe(true);
  });

  it('fails to load when the file cannot be fetched', async () => {
    const { audio, engine, playback } = setup();
    const loaded = engine.load(playback);
    audio.dispatchEvent(new Event('error'));
    await expect(loaded).rejects.toThrow(/could not be loaded/i);
  });

  it('play, pause, seek and time use the element', async () => {
    const { audio, engine, setTime } = setup();
    await engine.play();
    expect(audio.play).toHaveBeenCalled();
    engine.pause();
    expect(audio.pause).toHaveBeenCalled();
    engine.seek(41200);
    expect(audio.currentTime).toBe(41.2);
    setTime(43.2);
    expect(engine.timeMs()).toBe(43200);
  });

  it('play also works where the element returns nothing from play()', async () => {
    const { audio, engine } = setup();
    audio.play = vi.fn().mockReturnValue(undefined);
    await expect(engine.play()).resolves.toBeUndefined();
  });

  it('play passes on a refusal because there was no tap yet', async () => {
    const { audio, engine } = setup();
    audio.play = vi.fn().mockRejectedValue(new DOMException('no gesture', 'NotAllowedError'));
    await expect(engine.play()).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('tells when the song ended', () => {
    const { audio, engine } = setup();
    const ended = vi.fn();
    engine.onEnded(ended);
    audio.dispatchEvent(new Event('ended'));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('has no audio clock, so dropouts are not read from it (a network stall is not a weak device)', () => {
    expect((setup().engine as Engine).audioClock).toBeUndefined();
  });

  it('dispose releases the file and ignores later events', () => {
    const { audio, engine } = setup();
    const ended = vi.fn();
    engine.onEnded(ended);
    engine.dispose();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.hasAttribute('src')).toBe(false);
    expect(audio.load).toHaveBeenCalled();
    audio.dispatchEvent(new Event('ended'));
    expect(ended).not.toHaveBeenCalled();
    engine.dispose(); // twice is fine
  });
});

class FakeContext {
  state = 'running';
  sampleRate: number | undefined;
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

class FakeSynth {
  static last?: FakeSynth;
  soundBankManager = { addSoundBank: vi.fn().mockResolvedValue(undefined) };
  isReady = Promise.resolve();
  connect = vi.fn();
  setSystemParameter = vi.fn();
  destroy = vi.fn();
  constructor(public ctx: unknown) {
    FakeSynth.last = this;
  }
}

class FakeSeq {
  static last?: FakeSeq;
  handlers: Record<string, () => void> = {};
  eventHandler = { addEvent: (name: string, _id: string, cb: () => void) => (this.handlers[name] = cb) };
  loadNewSongList = vi.fn((songs: { binary: ArrayBuffer }[]) => {
    void songs;
    queueMicrotask(() => this.handlers['songChange']?.());
  });
  play = vi.fn();
  pause = vi.fn();
  currentTime = 0;
  skipToFirstNoteOn = true;
  constructor(public synth: unknown) {
    FakeSeq.last = this;
  }
}

function midiSetup(opts: { sampleRate?: number; voiceCap?: number; effects: boolean }, fetchBuffer?: MidiDeps['fetchBuffer']) {
  let ctx!: FakeContext;
  FakeSynth.last = FakeSeq.last = undefined;
  const fetched: string[] = [];
  const deps: MidiDeps = {
    createContext: (sampleRate) => {
      ctx = new FakeContext();
      ctx.sampleRate = sampleRate;
      return ctx as never;
    },
    loadLib: async () => ({ WorkletSynthesizer: FakeSynth as never, Sequencer: FakeSeq as never }),
    fetchBuffer:
      fetchBuffer ??
      (async (url) => {
        fetched.push(url);
        return new TextEncoder().encode(url).buffer as ArrayBuffer;
      }),
    workletUrl: () => 'https://k.example/assets/spessasynth/spessasynth_processor.min.js',
  };
  const engine = new MidiEngine(BASE, opts, deps);
  const playback = create(PlaybackSchema, {
    kind: PlaybackKind.MIDI_SYNTH,
    midiUrl: '/media/song/21628?exp=9&sig=m',
    soundfontUrl: '/media/soundfont/21628.sf2?exp=9&sig=s',
    ready: true,
  });
  return { engine, playback, fetched, get ctx() { return ctx; }, get synth() { return FakeSynth.last as FakeSynth; }, get seq() { return FakeSeq.last as FakeSeq; } };
}

describe('MidiEngine', () => {
  it('builds the synth with the song\'s SoundFont and MIDI file', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    expect(m.ctx.audioWorklet.addModule).toHaveBeenCalledWith('https://k.example/assets/spessasynth/spessasynth_processor.min.js');
    expect([...m.fetched].sort()).toEqual(['https://k.example/media/song/21628?exp=9&sig=m', 'https://k.example/media/soundfont/21628.sf2?exp=9&sig=s']);
    expect(m.synth.connect).toHaveBeenCalledWith(m.ctx.destination);
    expect(m.synth.soundBankManager.addSoundBank).toHaveBeenCalledTimes(1);
    const [bank, id] = m.synth.soundBankManager.addSoundBank.mock.calls[0];
    expect(new TextDecoder().decode(bank)).toBe('https://k.example/media/soundfont/21628.sf2?exp=9&sig=s');
    expect(id).toBe('main');
    const list = m.seq.loadNewSongList.mock.calls[0][0];
    expect(new TextDecoder().decode(list[0].binary)).toBe('https://k.example/media/song/21628?exp=9&sig=m');
    expect(m.seq.skipToFirstNoteOn).toBe(false); // the intro plays in real time so that the count-in shows
  });

  it('full power: default sample rate, no limits, effects stay on', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    expect(m.ctx.sampleRate).toBeUndefined();
    expect(m.synth.setSystemParameter).not.toHaveBeenCalled();
  });

  it('low power: 22.05 kHz, 32 voices, no reverb or chorus', async () => {
    const m = midiSetup({ sampleRate: 22050, voiceCap: 32, effects: false });
    await m.engine.load(m.playback);
    expect(m.ctx.sampleRate).toBe(22050);
    expect(m.synth.setSystemParameter).toHaveBeenCalledWith('voiceCap', 32);
    expect(m.synth.setSystemParameter).toHaveBeenCalledWith('effectsEnabled', false);
  });

  it('play resumes the audio context first; pause, seek and time go to the sequencer', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    await m.engine.play();
    expect(m.ctx.resume).toHaveBeenCalled();
    expect(m.seq.play).toHaveBeenCalled();
    m.engine.pause();
    expect(m.seq.pause).toHaveBeenCalled();
    m.engine.seek(41200);
    expect(m.seq.currentTime).toBe(41.2);
    m.seq.currentTime = 43.25;
    expect(m.engine.timeMs()).toBe(43250);
  });

  it('exposes the audio clock for the dropout check', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    m.ctx.currentTime = 12.5;
    expect(m.engine.audioClock?.()).toBe(12.5);
  });

  it('tells when the song ended', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    const ended = vi.fn();
    m.engine.onEnded(ended);
    m.seq.handlers['songEnded']();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('dispose stops the sequencer, destroys the synth and closes the context, once', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    m.engine.dispose();
    m.engine.dispose();
    expect(m.seq.pause).toHaveBeenCalled();
    expect(m.synth.destroy).toHaveBeenCalledTimes(1);
    expect(m.ctx.close).toHaveBeenCalledTimes(1);
  });

  it('a failed download closes the context and fails the load', async () => {
    const m = midiSetup({ effects: true }, async () => {
      throw new Error('404');
    });
    await expect(m.engine.load(m.playback)).rejects.toThrow(/could not be loaded/i);
    expect(m.ctx.close).toHaveBeenCalled();
  });

  it('disposing while it is still loading releases everything that was created', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const m = midiSetup({ effects: true }, async () => {
      await gate;
      return new ArrayBuffer(4);
    });
    const loading = m.engine.load(m.playback);
    await Promise.resolve();
    await Promise.resolve();
    m.engine.dispose();
    release();
    await expect(loading).rejects.toThrow();
    expect(m.ctx.close).toHaveBeenCalledTimes(1);
    if (m.synth) expect(m.synth.destroy).toHaveBeenCalledTimes(1);
  });

  it('regression: a pause that arrives while play waits for the audio context stops the sound from starting', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    let release!: () => void;
    m.ctx.resume = vi.fn(() => new Promise<void>((r) => (release = r)));
    const playing = m.engine.play();
    m.engine.pause();
    release();
    await playing;
    expect(m.seq.play).not.toHaveBeenCalled();
  });

  it('play after a pause plays again', async () => {
    const m = midiSetup({ effects: true });
    await m.engine.load(m.playback);
    m.engine.pause();
    await m.engine.play();
    expect(m.seq.play).toHaveBeenCalledTimes(1);
  });

  describe('when the browser keeps the audio context asleep', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('regression: play asks for a tap instead of waiting for ever', async () => {
      const m = midiSetup({ effects: true });
      await m.engine.load(m.playback);
      m.ctx.state = 'suspended';
      m.ctx.resume = vi.fn(() => new Promise<void>(() => undefined)); // never answers without a tap
      const playing = m.engine.play();
      const outcome = expect(playing).rejects.toMatchObject({ name: 'NotAllowedError' });
      await vi.advanceTimersByTimeAsync(2000);
      await outcome;
      expect(m.seq.play).not.toHaveBeenCalled();
    });

    it('a context that wakes up in time plays', async () => {
      const m = midiSetup({ effects: true });
      await m.engine.load(m.playback);
      m.ctx.state = 'suspended';
      m.ctx.resume = vi.fn(async () => {
        m.ctx.state = 'running';
      });
      await m.engine.play();
      expect(m.seq.play).toHaveBeenCalled();
    });
  });
});
