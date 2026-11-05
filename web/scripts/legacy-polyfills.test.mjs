// Tests of web/legacy/polyfills.js (kantahe-org.5): the functions that Chromium 74 lacks, as small shims. Each runs in a fresh JavaScript
// context from which the native function was deleted; a context that has it keeps its own.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parse } from 'acorn';

const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'legacy', 'polyfills.js'), 'utf8');

/** A fresh context in which the four functions do not exist, with the polyfills loaded. */
function old() {
  const ctx = vm.createContext({});
  vm.runInContext('delete Object.hasOwn; delete Array.prototype.at; delete String.prototype.at; delete String.prototype.replaceAll;', ctx);
  assert.equal(vm.runInContext('typeof Object.hasOwn + typeof [].at + typeof "".at + typeof "".replaceAll', ctx), 'undefinedundefinedundefinedundefined');
  vm.runInContext(SOURCE, ctx);
  return (code) => vm.runInContext(code, ctx);
}

test('the file is plain ES2017 that a classic script tag can load', () => {
  parse(SOURCE, { ecmaVersion: 2017, sourceType: 'script' });
});

test('Object.hasOwn: own properties only, like the native one', () => {
  const run = old();
  assert.equal(run('Object.hasOwn({a: 1}, "a")'), true);
  assert.equal(run('Object.hasOwn({}, "toString")'), false);
  assert.equal(run('Object.hasOwn([1], 0)'), true);
  assert.equal(run('Object.hasOwn(Object.create({x: 1}), "x")'), false);
  assert.equal(run('var s = Symbol("k"); var o = {}; o[s] = 1; Object.hasOwn(o, s)'), true);
  assert.equal(run('try { Object.hasOwn(null, "a") } catch (e) { e instanceof TypeError }'), true);
});

test('Array.prototype.at and String.prototype.at: negative indexes count from the end, outside is undefined', () => {
  const run = old();
  assert.equal(run('[1, 2, 3].at(-1)'), 3);
  assert.equal(run('[1, 2, 3].at(0)'), 1);
  assert.equal(run('[1, 2, 3].at(5)'), undefined);
  assert.equal(run('[1, 2, 3].at(-4)'), undefined);
  assert.equal(run('[1, 2, 3].at(1.9)'), 2);
  assert.equal(run('[1, 2, 3].at(NaN)'), 1);
  assert.equal(run('"abc".at(-1)'), 'c');
  assert.equal(run('"abc".at(3)'), undefined);
  assert.equal(run('Array.prototype.at.call({length: 2, 0: "x", 1: "y"}, -1)'), 'y');
});

test('String.prototype.replaceAll: every occurrence of a string, every match of a global expression', () => {
  const run = old();
  assert.equal(run('"a-b-c".replaceAll("-", "+")'), 'a+b+c');
  assert.equal(run('"aaa".replaceAll("a", "b")'), 'bbb');
  assert.equal(run('"a.b.c".replaceAll(".", "!")'), 'a!b!c'); // a dot is a dot, not any character
  assert.equal(run('"a-b".replaceAll("-", "[$&]")'), 'a[-]b');
  assert.equal(run('"a-b".replaceAll("-", "$$")'), 'a$b');
  assert.equal(run('"a-b-c".replaceAll("-", function (m, i) { return "<" + m + i + ">"; })'), 'a<-1>b<-3>c');
  assert.equal(run('"abc".replaceAll("", "-")'), '-a-b-c-');
  assert.equal(run('"a1b22".replaceAll(/\\d/g, "#")'), 'a#b##');
  assert.equal(run('try { "a1".replaceAll(/\\d/, "#") } catch (e) { e instanceof TypeError }'), true); // an expression without g is refused
  assert.equal(run('try { String.prototype.replaceAll.call(null, "a", "b") } catch (e) { e instanceof TypeError }'), true);
});

test('the shims are not enumerable, so that for-in loops over arrays and strings see nothing new', () => {
  const run = old();
  assert.equal(run('var keys = []; for (var k in [1, 2]) keys.push(k); keys.join()'), '0,1');
  assert.equal(run('Object.keys(Object).indexOf("hasOwn")'), -1);
});

test('a context that has the functions keeps its own', () => {
  const ctx = vm.createContext({});
  const before = vm.runInContext('[Object.hasOwn, Array.prototype.at, String.prototype.at, String.prototype.replaceAll]', ctx);
  vm.runInContext(SOURCE, ctx);
  const after = vm.runInContext('[Object.hasOwn, Array.prototype.at, String.prototype.at, String.prototype.replaceAll]', ctx);
  for (let i = 0; i < 4; i++) assert.equal(after[i], before[i], `function ${i} was replaced`);
});
