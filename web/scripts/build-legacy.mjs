// Builds the legacy variant of the web app (kantahe-org.3): the finished web build (ng build, dist/web/browser) with every .js file
// converted by esbuild to syntax that Chromium 74 can read, written to dist/web-legacy/browser. File names are kept; other files are
// copied byte for byte. Run after ng build:
//   node scripts/build-legacy.mjs [--input DIR] [--output DIR] [--target chrome74]
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { checkDir } from './check-legacy-syntax.mjs';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** The oldest Chromium that runs the legacy build; the guard of the legacy page says so. The same number is kMinChromium in app/lib/player/min_webview.dart. */
export const LEGACY_MIN_CHROMIUM = 74;

const POLYFILLS = join(WEB, 'legacy', 'polyfills.js');
const LEGACY_CSS = join(WEB, 'legacy', 'legacy.css');

/**
 * Browser functions that Chromium 74 lacks and that code may call (a text search, so a hit can be a false alarm; the list is the place to
 * add the next one). `polyfilled` says whether legacy/polyfills.js has a shim for it.
 */
export const NEWER_FUNCTIONS = [
  { name: 'Object.hasOwn', pattern: /Object\.hasOwn\b/, polyfilled: true },
  { name: 'at()', pattern: /\.at\(/, polyfilled: true },
  { name: 'replaceAll()', pattern: /\.replaceAll\(/, polyfilled: true },
  { name: 'structuredClone', pattern: /\bstructuredClone\b/, polyfilled: false },
  { name: 'Promise.allSettled', pattern: /\.allSettled\b/, polyfilled: false },
  { name: 'findLast()', pattern: /\.findLast(Index)?\(/, polyfilled: false },
  { name: 'toSorted()/toReversed()', pattern: /\.to(Sorted|Reversed|Spliced)\(/, polyfilled: false },
  { name: 'Array.fromAsync', pattern: /Array\.fromAsync\b/, polyfilled: false },
  { name: 'Promise.withResolvers', pattern: /Promise\.withResolvers\b/, polyfilled: false },
  { name: 'AbortSignal.timeout', pattern: /AbortSignal\.(timeout|any)\b/, polyfilled: false },
  { name: 'crypto.randomUUID', pattern: /\.randomUUID\(/, polyfilled: false },
];

/** The entries of NEWER_FUNCTIONS that the .js files of a folder seem to call: [{ name, polyfilled, hits }]. */
export function findNewerFunctions(dir) {
  const found = NEWER_FUNCTIONS.map((f) => ({ name: f.name, polyfilled: f.polyfilled, hits: 0 }));
  (function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) {
        const code = readFileSync(path, 'utf8');
        NEWER_FUNCTIONS.forEach((f, i) => {
          const hits = code.match(new RegExp(f.pattern.source, 'g'));
          if (hits) found[i].hits += hits.length;
        });
      }
    }
  })(dir);
  return found.filter((f) => f.hits > 0);
}


/**
 * Edits the legacy copy of index.html: class="legacy" on <html> (the scope of legacy.css), the stylesheet before </head>, and the polyfills
 * as a classic script before the first script that has a src. A page without such a script is an error. Nothing happens without an index.html.
 */
function editLegacyPage(file) {
  if (!existsSync(file)) return;
  let html = readFileSync(file, 'utf8');
  const at = html.search(/<script\b[^>]*\bsrc=/);
  if (at < 0) throw new Error(`${file} has no <script src=...> to put the polyfills before: is it the index.html of the web build?`);
  html = html.slice(0, at) + '<script src="legacy-polyfills.js"></script>' + html.slice(at);
  html = html.replace(/<html\b([^>]*)>/, (whole, attrs) => (/\bclass=/.test(attrs) ? whole.replace(/class="/, 'class="legacy ') : `<html${attrs} class="legacy">`));
  html = html.replace('</head>', '<link rel="stylesheet" href="legacy.css"></head>');
  // served under /legacy/: its files must not mix with the modern ones, whose names can be the same
  if (!html.includes('<base href="/">')) throw new Error(`${file} has no <base href="/">: the legacy build is served under /legacy/ and needs it`);
  html = html.replace('<base href="/">', '<base href="/legacy/">');
  // the guard of the page says what this page can run on, not what the modern one needs
  if (!/var MIN_CHROMIUM = \d+;/.test(html)) throw new Error(`${file} has no 'var MIN_CHROMIUM = N;' (the minimum engine guard) to set for the legacy page`);
  html = html.replace(/var MIN_CHROMIUM = \d+;/, `var MIN_CHROMIUM = ${LEGACY_MIN_CHROMIUM};`);
  writeFileSync(file, html);
}

/** Converts the web build in `input` into `output` (which is emptied first). */
export async function buildLegacy({ input = join(WEB, 'dist', 'web', 'browser'), output = join(WEB, 'dist', 'web-legacy', 'browser'), target = 'chrome74' } = {}) {
  if (!existsSync(input)) throw new Error(`there is no web build at ${input}: run ng build first`);
  rmSync(output, { recursive: true, force: true });
  const stats = { converted: 0, copied: 0, bytesIn: 0, bytesOut: 0 };
  async function copyTree(from, to) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const source = join(from, entry.name);
      const dest = join(to, entry.name);
      if (entry.isDirectory()) {
        await copyTree(source, dest);
      } else if (entry.name.endsWith('.js')) {
        const code = readFileSync(source, 'utf8');
        const result = await transform(code, { loader: 'js', format: 'esm', target, legalComments: 'inline', minifyWhitespace: true });
        writeFileSync(dest, result.code);
        stats.converted++;
        stats.bytesIn += statSync(source).size;
        stats.bytesOut += statSync(dest).size;
      } else {
        copyFileSync(source, dest);
        stats.copied++;
      }
    }
  }
  await copyTree(input, output);
  copyFileSync(POLYFILLS, join(output, 'legacy-polyfills.js'));
  copyFileSync(LEGACY_CSS, join(output, 'legacy.css'));
  editLegacyPage(join(output, 'index.html'));
  return stats;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const options = {};
  for (const k of ['input', 'output']) if (arg(`--${k}`)) options[k] = resolve(arg(`--${k}`));
  if (arg('--target')) options.target = arg('--target');
  try {
    const out = options.output ?? join(WEB, 'dist', 'web-legacy', 'browser');
    const s = await buildLegacy(options);
    console.log(`converted ${s.converted} .js files (${s.bytesIn} -> ${s.bytesOut} bytes), copied ${s.copied} other files to ${out}`);
    const r = checkDir(out);
    console.log(r.ok ? 'ok: the legacy build has nothing that Chromium 74 cannot read' : `FAIL: ${JSON.stringify(r.totals)} ${JSON.stringify(r.failures)}`);
    for (const f of findNewerFunctions(out)) {
      console.log(`${f.polyfilled ? 'shimmed' : 'WARNING: no shim for'} ${f.name} (${f.hits} hits)`);
    }
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`build-legacy: ${e.message}`);
    process.exit(1);
  }
}
