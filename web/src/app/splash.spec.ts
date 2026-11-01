/// <reference types="node" />
import { readFileSync } from 'node:fs';

// The splash is plain HTML and CSS in index.html (docs/PLAN.md section 8): these tests read the file and the brand sources as text,
// because what matters is what a browser gets before any script runs.
const html = readFileSync('src/index.html', 'utf8');
const logo = readFileSync('../branding/kantahe-splash-logo.svg', 'utf8');
const buildPy = readFileSync('../branding/build.py', 'utf8');

const parsed = () => new DOMParser().parseFromString(html, 'text/html');
const css = () => /<style>([\s\S]*?)<\/style>/.exec(html)![1];
const block = () => /<!-- brand-splash:begin -->([\s\S]*?)<!-- brand-splash:end -->/.exec(html)![1];
const squash = (s: string) => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();

describe('the splash in index.html', () => {
  it('is the first thing in the body, outside <app-root>, and says what is going on', () => {
    const doc = parsed();
    const splash = doc.getElementById('splash')!;
    expect(splash).not.toBeNull();
    expect(doc.body.firstElementChild).toBe(splash);
    expect(splash.nextElementSibling?.tagName.toLowerCase()).toBe('app-root');
    expect(splash.contains(doc.querySelector('app-root'))).toBe(false);
    expect(splash.getAttribute('role')).toBe('status');
    expect(splash.getAttribute('aria-live')).toBe('polite');
    expect(splash.textContent).toContain('Loading Kantahe');
    expect(splash.querySelector('noscript')?.textContent).toContain('Kantahe needs JavaScript to run.');
  });

  it('is an inline SVG: no image, no request, no remote url', () => {
    const doc = parsed();
    const splash = doc.getElementById('splash')!;
    expect(splash.querySelector('svg')).not.toBeNull();
    expect(splash.querySelector('img')).toBeNull();
    expect(html).not.toMatch(/<img\b/i);
    expect(css()).not.toMatch(/url\(\s*['"]?(https?:|\/\/|data:)/i);
    expect(css()).not.toMatch(/@import/);
    expect(doc.head.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    expect(splash.querySelector('svg')!.outerHTML).not.toMatch(/\b(?:href|src)="(?!#)/); // nothing else is fetched
  });

  it('keeps its critical CSS small and inline, with a reduced-motion rule', () => {
    expect(css().length).toBeLessThan(3000);
    expect(css()).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{\.splash-logo\{animation/);
    expect(css()).toMatch(/@media \(prefers-reduced-motion:reduce\)/);
  });

  it('shows no logo inside the Flutter WebView (/embed/...), only the dark colour', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    expect(script).toContain('location.pathname.indexOf("/embed/")===0');
    expect(script).toContain('className+=" embed"');
    expect(css()).toMatch(/html\.embed \.splash-logo/);
    expect(css()).toMatch(/html\.embed [^{]*\.splash-failed/);
    // the browser-side rule: add the class and the logo is not displayed
    document.head.insertAdjacentHTML('beforeend', `<style id="t">${css()}</style>`);
    document.body.insertAdjacentHTML('beforeend', `<div id="splash"><div class="splash-logo">x</div></div>`);
    document.documentElement.classList.add('embed');
    try {
      expect(getComputedStyle(document.querySelector('.splash-logo')!).display).toBe('none');
      expect(getComputedStyle(document.getElementById('splash')!).backgroundColor).toMatch(/rgb\(10, 14, 34\)|#0a0e22/);
    } finally {
      document.documentElement.classList.remove('embed');
      document.getElementById('t')!.remove();
      document.getElementById('splash')!.remove();
    }
  });

  it('DRIFT: the logo is exactly branding/kantahe-splash-logo.svg (ids prefixed), so neither side can be edited by hand', () => {
    const unprefixed = block().replace(/splash-(bg|ball)/g, '$1');
    expect(squash(unprefixed)).toBe(squash(logo));
    expect(block()).toContain('id="splash-bg"');
    expect(block()).toContain('url(#splash-bg)');
    expect(block()).not.toMatch(/id="(?!splash-)/); // every id is prefixed: no clash with another inline SVG
  });

  it('BRAND COLOURS: kanta is sung (#ffd23f), he is unsung (#ffffff), the accent is #4fd1ff', () => {
    const svg = block();
    const strokes = [...svg.matchAll(/<path stroke="(#[0-9a-f]{6})" d="/g)].map((m) => m[1]);
    expect(strokes).toEqual(['#ffd23f', '#ffffff']); // the two words of the wordmark, in order
    expect(svg).toContain('fill="#4fd1ff"');
  });

  it('BRAND BACKGROUND: #0a0e22, the colour of build.py splash() and not the ink #0c1230', () => {
    const official = /<rect width="1920" height="1080" fill="(#[0-9a-f]{6})"\/>/.exec(buildPy)![1];
    expect(official).toBe('#0a0e22');
    expect(/#splash\{[^}]*background-color:(#[0-9a-f]{6})/.exec(css())![1]).toBe(official);
    expect(/#splash\{[^}]*\}/.exec(css())![0]).not.toContain('#0c1230');
    expect(css()).toContain('rgba(79,209,255,.22)'); // the glow of the official splash, in CSS
  });

  it('is dark in every theme: no rule of the splash looks at the theme', () => {
    expect(css()).not.toMatch(/data-theme|prefers-color-scheme/);
    document.head.insertAdjacentHTML('beforeend', `<style id="t">${css()}</style>`);
    document.body.insertAdjacentHTML('beforeend', '<div id="splash"></div>');
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        expect(getComputedStyle(document.getElementById('splash')!).backgroundColor).toMatch(/rgb\(10, 14, 34\)|#0a0e22/);
      }
    } finally {
      document.documentElement.removeAttribute('data-theme');
      document.getElementById('t')!.remove();
      document.getElementById('splash')!.remove();
    }
  });

  it('is not hidden from the first frame by the app: it covers everything and is the top layer', () => {
    expect(/#splash\{[^}]*position:fixed/.exec(css())).not.toBeNull();
    expect(/#splash\{[^}]*z-index:2147483647/.exec(css())).not.toBeNull();
  });

  it('keeps the failure message out of the layout: hidden text still takes room, and the logo would sit off the centre', () => {
    expect(css()).toMatch(/\.splash-failed\{[^}]*position:absolute/);
    const logoAndMessage = /#splash\{[^}]*display:flex;flex-direction:column;align-items:center;justify-content:center/.test(css());
    expect(logoAndMessage, 'the splash centres its content as a column').toBe(true);
  });

  it('says so when the app cannot start: the message appears by CSS alone after 15 s', () => {
    expect(html).toContain('Kantahe could not start. Reload the page.');
    expect(css()).toMatch(/\.splash-failed\{[^}]*visibility:hidden;animation:splash-failed 0s linear 15s forwards/);
  });
});
