import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropoutWindows, lyricDrift } from './measure.mjs';

// one sample every 2 s: wall clock in ms, audio clock in seconds
const steady = (n) => Array.from({ length: n + 1 }, (_, i) => ({ wallMs: i * 2000, audioSec: i * 2 }));

test('no dropouts: audio time tracks wall time within 20 ms over 10 windows', () => {
  const samples = steady(10).map((s, i) => ({ ...s, audioSec: s.audioSec - (i % 2 ? 0.02 : 0) }));
  assert.equal(dropoutWindows(samples), 0);
});

test('one dropout: one 2 s window where the audio advanced 1.85 s', () => {
  const samples = steady(10);
  for (let i = 5; i < samples.length; i++) samples[i].audioSec -= 0.15;
  assert.equal(dropoutWindows(samples), 1);
});

test('two windows in a row that fall behind count twice', () => {
  const samples = steady(4);
  samples[2].audioSec -= 0.15;
  samples[3].audioSec -= 0.3;
  samples[4].audioSec -= 0.3;
  assert.equal(dropoutWindows(samples), 2);
});

test('fewer than two samples have no window', () => {
  assert.equal(dropoutWindows([]), 0);
  assert.equal(dropoutWindows([{ wallMs: 0, audioSec: 0 }]), 0);
});

test('lyric drift: tempo-map times [1000, 2000] fired at [1010, 1990] give a largest drift of 10', () => {
  const d = lyricDrift([
    { expectedMs: 1000, actualMs: 1010 },
    { expectedMs: 2000, actualMs: 1990 },
  ]);
  assert.equal(d.maxAbsMs, 10);
  assert.equal(d.count, 2);
  assert.equal(d.meanAbsMs, 10);
});

test('lyric drift: no events, no drift', () => {
  assert.deepEqual(lyricDrift([]), { count: 0, maxAbsMs: 0, meanAbsMs: 0 });
});
