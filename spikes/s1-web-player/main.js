import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { dropoutWindows, lyricDrift } from './measure.mjs';

const $ = (id) => document.getElementById(id);
const PROCESSOR = './node_modules/spessasynth_lib/dist/spessasynth_processor.min.js';
const LYRIC = 0x05; // a lyric meta event; .kar files keep their syllables in lyric or text (0x01) events
const TEXT = 0x01;
const SAMPLE_EVERY_MS = 2000;

const results = { autoplay: null, mic: null };
const run = { ctx: null, synth: null, seq: null, midi: null, samples: [], lyrics: [], timer: null, loadMs: null, sfLoadMs: null, sf: null, mode: 'normal' };

function status(text) { $('status').textContent = text; }
function mode() { return document.querySelector('input[name=mode]:checked').value; }

async function bytes(fileInput, urlInput) {
  const f = fileInput.files[0];
  if (f) return { name: f.name, buf: await f.arrayBuffer() };
  const url = urlInput.value.trim();
  if (!url) throw new Error('choose a file or give an address');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return { name: url.split('/').pop(), buf: await res.arrayBuffer() };
}

async function load(files) {
  const t0 = performance.now();
  stop();
  const m = mode();
  status('Loading the files…');
  const sf = files?.sf ?? (await bytes($('sfFile'), $('sfUrl')));
  const sfBytes = sf.buf.byteLength; // the synthesizer takes the buffer over: its length reads 0 afterwards
  const midi = files?.midi ?? (await bytes($('midiFile'), $('midiUrl')));
  const lowPower = m === 'lowPower';
  // the context is created here, on load: whether it may start without a tap is what the autoplay test reads
  const ctx = new AudioContext(lowPower ? { sampleRate: 22050 } : undefined);
  await ctx.audioWorklet.addModule(PROCESSOR);
  const synth = new WorkletSynthesizer(ctx);
  synth.connect(ctx.destination);
  const t1 = performance.now();
  status('Loading the SoundFont into the synthesizer…');
  await synth.soundBankManager.addSoundBank(sf.buf, 'main');
  await synth.isReady;
  run.sfLoadMs = Math.round(performance.now() - t1);
  if (lowPower) {
    synth.setSystemParameter('voiceCap', 32);
    synth.setSystemParameter('effectsEnabled', false);
  }
  const seq = new Sequencer(synth);
  seq.skipToFirstNoteOn = false;
  run.lyrics = [];
  run.metaSeen = {};
  seq.eventHandler.addEvent('metaEvent', 's1-lyric', ({ event }) => {
    run.metaSeen[event.statusByte] = (run.metaSeen[event.statusByte] ?? 0) + 1;
    if ((event.statusByte !== LYRIC && event.statusByte !== TEXT) || !run.midi) return;
    if (event.statusByte === TEXT && event.data[0] === 0x40) return; // '@' marks the information lines of a .kar, not a syllable
    run.lyrics.push({ expectedMs: run.midi.midiTicksToSeconds(event.ticks) * 1000, actualMs: seq.currentTime * 1000 });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the song did not load in 20 s')), 20000);
    seq.eventHandler.addEvent('songChange', 's1-ready', (e) => { run.midi = e.midiData; clearTimeout(timer); resolve(); });
    seq.loadNewSongList([{ binary: midi.buf }]);
  });
  Object.assign(run, { ctx, synth, seq, sf: { name: sf.name, bytes: sfBytes }, midiName: midi.name, mode: m, loadMs: Math.round(performance.now() - t0), samples: [] });
  $('play').disabled = false;
  $('pause').disabled = false;
  status(`Loaded in ${run.loadMs} ms (SoundFont ${run.sfLoadMs} ms). Context: ${ctx.state}.`);
  render();
}

async function play() {
  await run.ctx.resume();
  run.seq.play();
  if (!run.timer) {
    run.samples.push({ wallMs: performance.now(), audioSec: run.ctx.currentTime });
    run.timer = setInterval(() => {
      run.samples.push({ wallMs: performance.now(), audioSec: run.ctx.currentTime });
      render();
    }, SAMPLE_EVERY_MS);
  }
  status('Playing. Let the whole song run.');
}

function pause() {
  run.seq?.pause();
  clearInterval(run.timer);
  run.timer = null;
  status('Paused.');
}

function stop() {
  clearInterval(run.timer);
  run.timer = null;
  try { run.synth?.destroy(); } catch { /* already gone */ }
  void run.ctx?.close();
  Object.assign(run, { ctx: null, synth: null, seq: null, midi: null });
}

function snapshot() {
  const mem = performance.memory;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    secureContext: window.isSecureContext,
    soundFont: run.sf,
    song: run.midiName ?? null,
    mode: run.mode,
    sampleRate: run.ctx?.sampleRate ?? null,
    // read back from the synthesizer: proves the mode took effect on this device
    appliedVoiceCap: run.synth?.systemParameters?.voiceCap ?? null,
    appliedEffectsEnabled: run.synth?.systemParameters?.effectsEnabled ?? null,
    contextState: run.ctx?.state ?? null,
    soundFontLoadMs: run.sfLoadMs,
    totalLoadMs: run.loadMs,
    usedJSHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    playedSeconds: run.ctx ? Math.round(run.ctx.currentTime) : null,
    dropoutWindows: dropoutWindows(run.samples),
    windows: Math.max(0, run.samples.length - 1),
    lyricDrift: lyricDrift(run.lyrics),
    metaEventsSeen: run.metaSeen ?? {},
    midiHasLyrics: run.midi ? run.midi.lyrics.length : null,
    autoplay: results.autoplay,
    microphone: results.mic,
    measuredAt: new Date().toISOString(),
  };
}

function render() { $('stats').textContent = JSON.stringify(snapshot(), null, 2); }

async function micTest() {
  results.mic = null;
  status('Asking for the microphone…');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no getUserMedia (needs HTTPS or localhost)');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const analyser = ac.createAnalyser();
    ac.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let max = 0;
    const until = performance.now() + 3000;
    while (performance.now() < until) {
      analyser.getFloatTimeDomainData(data);
      max = Math.max(max, Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length));
      await new Promise((r) => setTimeout(r, 50));
    }
    stream.getTracks().forEach((t) => t.stop());
    void ac.close();
    results.mic = { allowed: true, maxRms: Number(max.toFixed(4)) };
  } catch (e) {
    results.mic = { allowed: false, error: String(e && e.name ? `${e.name}: ${e.message}` : e) };
  }
  status(`Microphone: ${JSON.stringify(results.mic)}`);
  render();
}

// The autoplay test must start without a tap, so it reloads the page with the files by address and tries to
// start the audio from the page itself: a click on this page earlier would count as the tap the browsers want.
function autoplayTest() {
  if (!$('sfUrl').value.trim() || !$('midiUrl').value.trim()) {
    status('Autoplay test: give both the SoundFont and the song by address first; the page reloads and loads them by itself.');
    return;
  }
  const p = new URLSearchParams({ autoplay: '1', sf: $('sfUrl').value.trim(), midi: $('midiUrl').value.trim(), mode: mode() });
  location.search = p.toString();
}

async function autoplayOnLoad(p) {
  document.querySelector(`input[name=mode][value=${p.get('mode') || 'normal'}]`).checked = true;
  const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return { name: u.split('/').pop(), buf: await r.arrayBuffer() }; };
  try {
    await load({ sf: await fetchBuf(p.get('sf')), midi: await fetchBuf(p.get('midi')) });
    await new Promise((r) => setTimeout(r, 1000));
    // no tap happened: a context that is "running" now may start by itself
    const allowed = run.ctx.state === 'running';
    results.autoplay = { allowedWithoutTap: allowed, contextStateAfter1s: run.ctx.state };
    if (!allowed) await Promise.race([run.ctx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    results.autoplay.stateAfterResume = run.ctx.state;
    status(`Autoplay: ${JSON.stringify(results.autoplay)}`);
  } catch (e) {
    results.autoplay = { error: String(e) };
    status(`Autoplay test failed: ${e}`);
  }
  render();
}

async function copy() {
  const text = JSON.stringify(snapshot(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    status('Results copied.');
  } catch {
    // TV browsers often have no clipboard: show the text to select instead
    $('json').style.display = 'block';
    $('json').value = text;
    $('json').select();
    status('Copy the text below by hand.');
  }
}

function guard(fn) { return async () => { try { await fn(); } catch (e) { status(`Error: ${e && e.message ? e.message : e}`); } }; }
$('load').onclick = guard(() => load());
$('play').onclick = guard(play);
$('pause').onclick = guard(async () => pause());
$('mic').onclick = guard(micTest);
$('autoplay').onclick = guard(async () => autoplayTest());
$('copy').onclick = guard(copy);
window.kantaheS1 = { snapshot }; // for the scripted desktop run

const params = new URLSearchParams(location.search);
if (params.get('autoplay') === '1') void autoplayOnLoad(params);
else render();
