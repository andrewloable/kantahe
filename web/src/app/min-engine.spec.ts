import { readFileSync } from 'node:fs';

// The minimum engine (docs/PLAN.md, "Minimum engine"): below Chromium 85 the web app cannot even be parsed (optional chaining and ??
// need 80, logical assignment needs 85), so the page would stay on its logo for ever. index.html has a small guard, written in old
// JavaScript so that it runs on the oldest engine, that says so instead.
const html = readFileSync('src/index.html', 'utf8');
const server = readFileSync('../server/internal/webui/webui.go', 'utf8');

function guardSource(): string {
  const m = /<script id="min-engine">([\s\S]*?)<\/script>/.exec(html);
  expect(m, 'index.html has no <script id="min-engine">').not.toBeNull();
  return m![1];
}

/** Runs the guard of index.html as a browser with this user agent would. */
function visit(userAgent: string): { old: boolean; text: string } {
  document.documentElement.className = '';
  document.body.innerHTML = '<div id="splash"><p class="splash-old" id="splash-old"></p></div>';
  new Function('navigator', 'document', guardSource())({ userAgent }, document);
  return { old: document.documentElement.classList.contains('old'), text: document.getElementById('splash-old')!.textContent ?? '' };
}

const ua = (chrome: string) => `Mozilla/5.0 (Linux; Android 10; TV Build/QP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${chrome} Safari/537.36`;

describe('the minimum engine guard of index.html', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.body.innerHTML = '';
  });

  it('says that the browser is too old, with both versions, below Chromium 85', () => {
    for (const v of ['74.0.3729.186', '83.0.4103.120', '84.0.4147.89']) {
      const r = visit(ua(v));
      expect(r.old, v).toBe(true);
      expect(r.text, v).toContain(`Chromium ${v.split('.')[0]}`);
      expect(r.text, v).toContain('Chromium 85 or newer');
      expect(r.text, v).toContain('Android System WebView');
    }
  });

  it('does nothing at Chromium 85 and above', () => {
    for (const v of ['85.0.4183.83', '113.0.5672.136', '157.0.8103.38']) {
      const r = visit(ua(v));
      expect(r.old, v).toBe(false);
      expect(r.text, v).toBe('');
    }
  });

  it('does nothing for a browser that is not Chromium, or has no user agent', () => {
    for (const agent of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      '',
    ]) {
      const r = visit(agent);
      expect(r.old, agent).toBe(false);
      expect(r.text, agent).toBe('');
    }
  });

  it('is written in old JavaScript: it has to run on the engine that cannot read the app', () => {
    const code = guardSource().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const [name, pattern] of [
      ['an arrow function', /=>/],
      ['let or const', /\b(let|const)\b/],
      ['a template string', /`/],
      ['async or await', /\b(async|await)\b/],
      ['optional chaining', /\?\./],
      ['nullish coalescing', /\?\?/],
      ['a class', /\bclass\b/],
    ] as const) {
      expect(pattern.test(code), `the guard uses ${name}`).toBe(false);
    }
  });

  it('sits before the app in the page, and the page styles show the message in place of the logo', () => {
    expect(html.indexOf('id="min-engine"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="min-engine"')).toBeLessThan(html.indexOf('<app-root>'));
    expect(html).toContain('html.old .splash-old{display:block}');
    expect(html).toContain('html.old .splash-logo');
    expect(html).toContain('.splash-old{display:none');
  });

  it('names the same minimum as the server, which gives the legacy player to older engines (ModernMinChromium in server/internal/webui/webui.go)', () => {
    const web = /MIN_CHROMIUM\s*=\s*(\d+)/.exec(guardSource());
    const go = /const ModernMinChromium\s*=\s*(\d+)/.exec(server);
    expect(web, 'no MIN_CHROMIUM in index.html').not.toBeNull();
    expect(go, 'no ModernMinChromium in webui.go').not.toBeNull();
    expect(web![1]).toBe(go![1]);
  });
});
