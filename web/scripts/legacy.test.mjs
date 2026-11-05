// Tests of the legacy build (kantahe-org.3): web/scripts/build-legacy.mjs turns the finished web build into a build that Chromium 74 can read,
// web/scripts/check-legacy-syntax.mjs says whether a folder of JavaScript has syntax that Chromium 74 cannot read.
// Run with: npm run test:legacy
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildLegacy, findNewerFunctions } from './build-legacy.mjs';
import { checkDir, scanSource } from './check-legacy-syntax.mjs';

const ZERO = { optionalChain: 0, nullish: 0, logicalAssign: 0, staticBlock: 0, numericSeparator: 0, topLevelAwait: 0 };

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'kantahe-legacy-'));
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the scanner counts what Chromium 74 cannot read', () => {
  const counts = scanSource('const a = x?.y; const b = x ?? 1; z ||= 2; z &&= 3; z ??= 4; const n = 1_000; await Promise.resolve(); class C { static { C.k = 1; } }');
  assert.deepEqual(counts, { optionalChain: 1, nullish: 1, logicalAssign: 3, staticBlock: 1, numericSeparator: 1, topLevelAwait: 1 });
});

test('the scanner finds nothing in plain older syntax, and does not take a conditional with a decimal for an optional chain', () => {
  assert.deepEqual(scanSource('var a = b ? .5 : 1; async function f() { await g(); } class C { x = 1; #y = 2; }'), ZERO);
});

test('checkDir fails for a folder with such syntax and passes for one without', () => {
  const { dir, done } = scratch();
  try {
    mkdirSync(join(dir, 'bad'));
    mkdirSync(join(dir, 'good'));
    writeFileSync(join(dir, 'bad', 'a.js'), 'export const v = o?.p ?? 1;');
    writeFileSync(join(dir, 'good', 'a.js'), 'export const v = 1;');
    assert.equal(checkDir(join(dir, 'bad')).ok, false);
    assert.equal(checkDir(join(dir, 'bad')).files['a.js'].optionalChain, 1);
    assert.equal(checkDir(join(dir, 'good')).ok, true);
  } finally {
    done();
  }
});

test('the build converts every .js, keeps the names, and leaves other files byte for byte as they were', async () => {
  const { dir, done } = scratch();
  try {
    const input = join(dir, 'in');
    const output = join(dir, 'out');
    mkdirSync(join(input, 'media'), { recursive: true });
    writeFileSync(join(input, 'main-ABC.js'), 'import "./chunk-X.js"; export const v = o?.p ?? (q ||= 2);');
    writeFileSync(join(input, 'chunk-X.js'), 'export const w = a?.b;');
    const css = 'body{margin:0}\n';
    const bytes = Buffer.from([0, 1, 2, 250, 251]);
    writeFileSync(join(input, 'styles-1.css'), css);
    writeFileSync(join(input, 'media', 'icon.bin'), bytes);
    const result = await buildLegacy({ input, output });
    assert.deepEqual(readdirSync(output).sort(), [...readdirSync(input), 'legacy-polyfills.js', 'legacy.css'].sort()); // the same files, the polyfills and the stylesheet
    assert.equal(readFileSync(join(output, 'styles-1.css'), 'utf8'), css);
    assert.deepEqual(readFileSync(join(output, 'media', 'icon.bin')), bytes);
    assert.equal(checkDir(output).ok, true);
    assert.match(readFileSync(join(output, 'main-ABC.js'), 'utf8'), /import\s*["']\.\/chunk-X\.js["']/);
    assert.equal(result.converted, 2);
  } finally {
    done();
  }
});

test('the build copies the polyfills and loads them before the first script of the page', async () => {
  const { dir, done } = scratch();
  try {
    const input = join(dir, 'in');
    const output = join(dir, 'out');
    mkdirSync(input);
    writeFileSync(join(input, 'main-ABC.js'), 'export const v = 1;');
    writeFileSync(
      join(input, 'index.html'),
      '<html><head><base href="/"><script>var inline = 1;</script><script id="min-engine">var MIN_CHROMIUM = 85;</script><link rel="modulepreload" href="main-ABC.js"></head><body><app-root></app-root><script src="main-ABC.js" type="module"></script></body></html>',
    );
    await buildLegacy({ input, output });
    const html = readFileSync(join(output, 'index.html'), 'utf8');
    assert.ok(html.includes('<script src="legacy-polyfills.js"></script>'), 'the polyfill script is not in the page');
    assert.ok(html.indexOf('legacy-polyfills.js') < html.indexOf('src="main-ABC.js"'), 'the polyfills must come before the app');
    assert.equal(readFileSync(join(output, 'legacy-polyfills.js'), 'utf8'), readFileSync(join(import.meta.dirname, '..', 'legacy', 'polyfills.js'), 'utf8'));
  } finally {
    done();
  }
});

test('a page with an index.html but no script to put the polyfills before is an error', async () => {
  const { dir, done } = scratch();
  try {
    const input = join(dir, 'in');
    mkdirSync(input);
    writeFileSync(join(input, 'index.html'), '<html><body>nothing to run</body></html>');
    await assert.rejects(() => buildLegacy({ input, output: join(dir, 'out') }), /index\.html/);
  } finally {
    done();
  }
});

test('findNewerFunctions names the newer functions that the code calls, and says which have a shim', () => {
  const { dir, done } = scratch();
  try {
    writeFileSync(join(dir, 'a.js'), 'Object.hasOwn(a, "b"); x.at(-1); s.replaceAll("a", "b"); structuredClone(v); Promise.allSettled(p);');
    const found = Object.fromEntries(findNewerFunctions(dir).map((f) => [f.name, f.polyfilled]));
    assert.equal(found['Object.hasOwn'], true);
    assert.equal(found['at()'], true);
    assert.equal(found['replaceAll()'], true);
    assert.equal(found['structuredClone'], false);
    assert.equal(found['Promise.allSettled'], false);
  } finally {
    done();
  }
});

test('the build says what to do when there is no web build to convert', async () => {
  await assert.rejects(() => buildLegacy({ input: '/nonexistent-web-build', output: '/tmp/never' }), /ng build/);
});

test('the build replaces an older legacy output instead of mixing with it', async () => {
  const { dir, done } = scratch();
  try {
    const input = join(dir, 'in');
    const output = join(dir, 'out');
    mkdirSync(input);
    mkdirSync(output);
    writeFileSync(join(output, 'stale.js'), 'export const old = 1;');
    writeFileSync(join(input, 'a.js'), 'export const a = 1;');
    await buildLegacy({ input, output });
    assert.equal(existsSync(join(output, 'stale.js')), false);
    assert.equal(existsSync(join(output, 'a.js')), true);
  } finally {
    done();
  }
});

// the real build of the web app, when ng build has been run: 569 optional chains, 265 ?? and 96 logical assignments become none
const REAL = join(import.meta.dirname, '..', 'dist', 'web', 'browser');
test('the real build: the normal output has the syntax, the legacy output has none', { skip: !existsSync(REAL) && 'run ng build first' }, async () => {
  const { dir, done } = scratch();
  try {
    const before = checkDir(REAL);
    assert.equal(before.ok, false, 'the normal build is expected to use modern syntax');
    await buildLegacy({ input: REAL, output: join(dir, 'legacy') });
    const after = checkDir(join(dir, 'legacy'));
    assert.deepEqual(after.totals, ZERO);
    assert.equal(after.ok, true);
  } finally {
    done();
  }
});
