/* Small shims for the functions that Chromium 74 lacks and the web app calls (kantahe-org.5). Only the legacy build loads this file, as a
   classic script before the app. Plain ES2017: no polyfill library. Each shim is defined only when the function is missing, not enumerable,
   and behaves like the native one. When the player is run on an old WebView and reports another missing function, add it here, with a test
   in scripts/legacy-polyfills.test.mjs, and in the list of scripts/build-legacy.mjs. */
(function () {
  'use strict';

  function define(target, name, fn) {
    if (typeof target[name] === 'function') return;
    Object.defineProperty(target, name, { value: fn, writable: true, configurable: true, enumerable: false });
  }

  function toInteger(value) {
    var n = Number(value);
    if (n !== n) return 0; // NaN
    return n < 0 ? Math.ceil(n) : Math.floor(n);
  }

  function requireObjectCoercible(value, what) {
    if (value === null || value === undefined) throw new TypeError(what + ' called on null or undefined');
    return value;
  }

  // Object.hasOwn (Chromium 93)
  define(Object, 'hasOwn', function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(Object(requireObjectCoercible(object, 'Object.hasOwn')), key);
  });

  // Array.prototype.at (Chromium 92)
  define(Array.prototype, 'at', function at(index) {
    var o = Object(requireObjectCoercible(this, 'Array.prototype.at'));
    var length = Math.min(Math.max(toInteger(o.length), 0), 9007199254740991);
    var k = toInteger(index);
    if (k < 0) k += length;
    return k < 0 || k >= length ? undefined : o[k];
  });

  // String.prototype.at (Chromium 92)
  define(String.prototype, 'at', function at(index) {
    var s = String(requireObjectCoercible(this, 'String.prototype.at'));
    var k = toInteger(index);
    if (k < 0) k += s.length;
    return k < 0 || k >= s.length ? undefined : s.charAt(k);
  });

  // String.prototype.replaceAll (Chromium 85)
  define(String.prototype, 'replaceAll', function replaceAll(searchValue, replaceValue) {
    var s = String(requireObjectCoercible(this, 'String.prototype.replaceAll'));
    if (Object.prototype.toString.call(searchValue) === '[object RegExp]') {
      if (String(searchValue.flags).indexOf('g') < 0) throw new TypeError('replaceAll must be called with a global RegExp');
      return s.replace(searchValue, replaceValue);
    }
    var pattern = new RegExp(String(searchValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    return s.replace(pattern, replaceValue);
  });
})();
