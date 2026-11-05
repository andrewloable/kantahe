// Says whether a folder of JavaScript has syntax that Chromium 74 cannot read (kantahe-org.3).
//   node scripts/check-legacy-syntax.mjs DIR     exits 1 when DIR has any, or a file that does not parse
// Counted: optional chaining (needs Chromium 80), ?? (80), ||= &&= ??= (85), class static blocks (94), numeric separators (75) and
// top-level await (89). Class fields and BigInt, which Chromium 74 reads, are not counted.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const KINDS = ['optionalChain', 'nullish', 'logicalAssign', 'staticBlock', 'numericSeparator', 'topLevelAwait'];

function zero() {
  return Object.fromEntries(KINDS.map((k) => [k, 0]));
}

/** The counts of the syntax Chromium 74 cannot read in one source text. Throws when the text does not parse. */
export function scanSource(source) {
  const counts = zero();
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  (function walk(node, insideFunction) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, insideFunction);
      return;
    }
    if (typeof node.type !== 'string') return;
    switch (node.type) {
      case 'ChainExpression':
        counts.optionalChain++;
        break;
      case 'LogicalExpression':
        if (node.operator === '??') counts.nullish++;
        break;
      case 'AssignmentExpression':
        if (['||=', '&&=', '??='].includes(node.operator)) counts.logicalAssign++;
        break;
      case 'StaticBlock':
        counts.staticBlock++;
        break;
      case 'Literal':
        if (typeof node.raw === 'string' && /^\d[\d_]*_[\d_]*/.test(node.raw) && (typeof node.value === 'number' || typeof node.value === 'bigint')) counts.numericSeparator++;
        break;
      case 'AwaitExpression':
        if (!insideFunction) counts.topLevelAwait++;
        break;
    }
    const isFunction = /Function/.test(node.type);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'raw') continue;
      walk(node[key], insideFunction || isFunction);
    }
  })(ast, false);
  return counts;
}

function listJs(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJs(path, base));
    else if (entry.name.endsWith('.js')) out.push(relative(base, path));
  }
  return out.sort();
}

/** Scans every .js file of a folder: { ok, files: {name: counts}, totals, failures: [{file, message}] }. */
export function checkDir(dir) {
  const files = {};
  const totals = zero();
  const failures = [];
  for (const name of listJs(dir)) {
    try {
      const counts = scanSource(readFileSync(join(dir, name), 'utf8'));
      files[name] = counts;
      for (const k of KINDS) totals[k] += counts[k];
    } catch (e) {
      failures.push({ file: name, message: String(e.message) });
    }
  }
  const ok = failures.length === 0 && KINDS.every((k) => totals[k] === 0);
  return { ok, files, totals, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/check-legacy-syntax.mjs DIR');
    process.exit(2);
  }
  const r = checkDir(dir);
  for (const [name, counts] of Object.entries(r.files)) {
    const bad = KINDS.filter((k) => counts[k] > 0).map((k) => `${k}=${counts[k]}`);
    if (bad.length) console.log(`${name}: ${bad.join(' ')}`);
  }
  for (const f of r.failures) console.log(`${f.file}: does not parse: ${f.message}`);
  console.log(`${Object.keys(r.files).length} files: ${KINDS.map((k) => `${k}=${r.totals[k]}`).join(' ')}`);
  console.log(r.ok ? 'ok: nothing that Chromium 74 cannot read' : 'FAIL: syntax that Chromium 74 cannot read');
  process.exit(r.ok ? 0 : 1);
}
