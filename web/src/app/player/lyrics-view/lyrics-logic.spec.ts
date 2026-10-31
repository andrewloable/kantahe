import { create } from '@bufbuild/protobuf';
import { LyricLineSchema, LyricWordSchema } from '../../../gen/kantahe/v1/common_pb';
import { activeLine, countIn, fitScale, rowsFor, wipe } from './lyrics-logic';

const line = (startMs: number, endMs: number, words: [string, number, number][] = []) =>
  create(LyricLineSchema, {
    startMs: BigInt(startMs),
    endMs: BigInt(endMs),
    words: words.map(([text, s, e]) => create(LyricWordSchema, { text, startMs: BigInt(s), endMs: BigInt(e) })),
  });

describe('activeLine', () => {
  const lines = [line(1000, 2000), line(5000, 6000)];
  it('is the last line that has started, with 50 ms of lead', () => {
    expect(activeLine(lines, 500)).toBe(-1);
    expect(activeLine(lines, 3000)).toBe(0);
    expect(activeLine(lines, 4960)).toBe(1);
  });
  it('the lead is exactly 50 ms', () => {
    expect(activeLine(lines, 949)).toBe(-1);
    expect(activeLine(lines, 950)).toBe(0);
    expect(activeLine(lines, 4949)).toBe(0);
    expect(activeLine(lines, 4950)).toBe(1);
  });
  it('stays on the last line after the song', () => {
    expect(activeLine(lines, 999_999)).toBe(1);
  });
  it('no lines, no active line', () => {
    expect(activeLine([], 1000)).toBe(-1);
  });
  it('agrees with a plain scan on many lines', () => {
    const many = Array.from({ length: 500 }, (_, i) => line(i * 700, i * 700 + 600));
    for (const t of [0, 49, 50, 699, 700, 12345, 349_299, 349_300, 1_000_000]) {
      let expected = -1;
      many.forEach((l, i) => {
        if (Number(l.startMs) <= t + 50) expected = i;
      });
      expect(activeLine(many, t), String(t)).toBe(expected);
    }
  });
});

describe('rowsFor', () => {
  it('even lines go to the top row, odd lines to the bottom', () => {
    expect(rowsFor(-1)).toEqual({ top: 0, bottom: 1 });
    expect(rowsFor(0)).toEqual({ top: 0, bottom: 1 });
    expect(rowsFor(1)).toEqual({ top: 2, bottom: 1 });
    expect(rowsFor(2)).toEqual({ top: 2, bottom: 3 });
    expect(rowsFor(3)).toEqual({ top: 4, bottom: 3 });
  });
});

describe('wipe', () => {
  const w = { startMs: 1000n, endMs: 1500n };
  it('runs from the start to the end of the word', () => {
    expect(wipe(w, 1250)).toBe(0.5);
    expect(wipe(w, 900)).toBe(0);
    expect(wipe(w, 2000)).toBe(1);
    expect(wipe(w, 1000)).toBe(0);
    expect(wipe(w, 1500)).toBe(1);
  });
  it('a word with no length is either not sung or sung', () => {
    const z = { startMs: 1000n, endMs: 1000n };
    expect(wipe(z, 999)).toBe(0);
    expect(wipe(z, 1000)).toBe(1);
  });
});

describe('countIn', () => {
  it('before a first line at 6000: 4 dots with 3.5 s left, 1 with 0.5 s, none with 5 s left', () => {
    const lines = [line(6000, 8000)];
    expect(countIn(lines, -1, 2500)).toBe(4);
    expect(countIn(lines, -1, 5500)).toBe(1);
    expect(countIn(lines, -1, 1000)).toBe(0);
  });
  it('counts whole seconds up: 4 above 3 s left, 3 above 2 s, 2 above 1 s, 1 below', () => {
    const lines = [line(6000, 8000)];
    expect(countIn(lines, -1, 2000)).toBe(4); // exactly 4000 left
    expect(countIn(lines, -1, 2999)).toBe(4);
    expect(countIn(lines, -1, 3000)).toBe(3);
    expect(countIn(lines, -1, 4000)).toBe(2);
    expect(countIn(lines, -1, 5000)).toBe(1);
    expect(countIn(lines, -1, 5999)).toBe(1);
  });
  it('is off exactly 4000 ms or more before, and when the time has come', () => {
    const lines = [line(6000, 8000)];
    expect(countIn(lines, -1, 1999)).toBe(0);
    expect(countIn(lines, -1, 6000)).toBe(0);
  });
  it('never before a first line that starts earlier than 4 s', () => {
    const lines = [line(3000, 5000)];
    for (const t of [0, 500, 1000, 2000, 2900]) expect(countIn(lines, -1, t), String(t)).toBe(0);
    const edge = [line(4000, 5000)];
    expect(countIn(edge, -1, 100)).toBe(4);
  });
  it('before a line that follows a gap of 5 s or more', () => {
    const lines = [line(0, 10000), line(16000, 18000)];
    expect(countIn(lines, 0, 13000)).toBe(3);
    expect(countIn(lines, 0, 15500)).toBe(1);
    expect(countIn(lines, 0, 11000)).toBe(0); // 5000 left
  });
  it('not for a gap of less than 5 s', () => {
    const lines = [line(0, 10000), line(14000, 16000)];
    expect(countIn(lines, 0, 11000)).toBe(0);
    expect(countIn(lines, 0, 13500)).toBe(0);
    const edge = [line(0, 10000), line(15000, 16000)];
    expect(countIn(edge, 0, 12000)).toBe(3); // a gap of exactly 5000
  });
  it('not after the last line, and not without lines', () => {
    expect(countIn([line(0, 1000)], 0, 500)).toBe(0);
    expect(countIn([], -1, 0)).toBe(0);
  });
});

describe('fitScale', () => {
  it('shrinks a row that is wider than its container, never enlarges one', () => {
    expect(fitScale(1000, 2000)).toBe(0.5);
    expect(fitScale(1000, 1000)).toBe(1);
    expect(fitScale(1000, 500)).toBe(1);
  });
  it('does nothing when there is nothing to measure', () => {
    expect(fitScale(0, 2000)).toBe(1);
    expect(fitScale(1000, 0)).toBe(1);
  });
});
