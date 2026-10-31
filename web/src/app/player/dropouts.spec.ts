import { DropoutMonitor } from './dropouts';

function setup(visible = () => true) {
  let audio = 0;
  let wall = 0;
  const onDropout = vi.fn();
  const monitor = new DropoutMonitor({ audioClock: () => audio, wallClock: () => wall, onDropout, isActive: visible });
  // time passes: wall milliseconds on the wall clock, audioSeconds on the audio clock
  const elapse = (wallMs: number, audioSeconds: number) => {
    wall += wallMs;
    audio += audioSeconds;
    vi.advanceTimersByTime(wallMs);
  };
  return { monitor, onDropout, elapse };
}

describe('DropoutMonitor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('1.85 s of audio in 2 s is a dropout', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    elapse(2000, 1.85);
    expect(onDropout).toHaveBeenCalledTimes(1);
  });

  it('1.95 s of audio in 2 s is not', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    elapse(2000, 1.95);
    expect(onDropout).not.toHaveBeenCalled();
  });

  it('exactly 100 ms short is still fine; a little more is not', () => {
    const a = setup();
    a.monitor.start();
    a.elapse(2000, 1.9);
    expect(a.onDropout).not.toHaveBeenCalled();
    const b = setup();
    b.monitor.start();
    b.elapse(2000, 1.899);
    expect(b.onDropout).toHaveBeenCalledTimes(1);
  });

  it('looks every 2 s, comparing with the last look', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    elapse(2000, 2);
    elapse(2000, 1.5); // a stall in the second window
    elapse(2000, 2);
    expect(onDropout).toHaveBeenCalledTimes(1);
    elapse(2000, 1.5);
    expect(onDropout).toHaveBeenCalledTimes(2);
  });

  it('does not look before 2 s have passed', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    elapse(1999, 0);
    expect(onDropout).not.toHaveBeenCalled();
  });

  it('stop ends the checks, and a new start begins from the clocks as they are then', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    monitor.stop();
    elapse(10_000, 0); // paused: the audio clock stood still, nobody looked
    expect(onDropout).not.toHaveBeenCalled();
    monitor.start();
    elapse(2000, 2);
    expect(onDropout).not.toHaveBeenCalled();
  });

  it('start twice runs one check', () => {
    const { monitor, onDropout, elapse } = setup();
    monitor.start();
    monitor.start();
    elapse(2000, 1);
    expect(onDropout).toHaveBeenCalledTimes(1);
  });

  it('a page nobody sees is not judged: the browser may have put the audio to sleep', () => {
    let visible = false;
    const { monitor, onDropout, elapse } = setup(() => visible);
    monitor.start();
    elapse(2000, 0);
    expect(onDropout).not.toHaveBeenCalled();
    visible = true;
    elapse(2000, 2);
    expect(onDropout).not.toHaveBeenCalled();
    elapse(2000, 1);
    expect(onDropout).toHaveBeenCalledTimes(1);
  });
});
