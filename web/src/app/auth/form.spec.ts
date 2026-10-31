import { Code, ConnectError } from '@connectrpc/connect';
import { fromServer, passwordLengthOk, problem, safeReturnUrl, validEmail, webDeviceName } from './form';

describe('validEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const ok of ['a@b.co', 'first.last+tag@example.com', ' a@example.com ']) expect(validEmail(ok), ok).toBe(true);
  });
  it('rejects anything else', () => {
    for (const bad of ['', 'a', 'a@b', '@b.co', 'a@@b.co', 'a b@c.co', `${'x'.repeat(250)}@b.co`]) expect(validEmail(bad), bad).toBe(false);
  });
});

describe('passwordLengthOk', () => {
  it('counts bytes like the server: 8 to 256', () => {
    expect(passwordLengthOk('1234567')).toBe(false);
    expect(passwordLengthOk('12345678')).toBe(true);
    expect(passwordLengthOk('x'.repeat(256))).toBe(true);
    expect(passwordLengthOk('x'.repeat(257))).toBe(false);
    expect(passwordLengthOk('é'.repeat(4))).toBe(true); // 8 bytes
    expect(passwordLengthOk('é'.repeat(129))).toBe(false); // 258 bytes
  });
});

describe('safeReturnUrl', () => {
  it('keeps a path inside the app', () => {
    expect(safeReturnUrl('/queue')).toBe('/queue');
    expect(safeReturnUrl('/library?q=abc')).toBe('/library?q=abc');
  });
  it('falls back to the library for anything else', () => {
    for (const bad of [null, undefined, '', 'queue', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/login', '/login?x=1', '/setup']) {
      expect(safeReturnUrl(bad), String(bad)).toBe('/library');
    }
  });
});

describe('safeReturnUrl regression: other spellings of the sign-in pages', () => {
  it('does not send a signed-in user back to the sign-in or setup page', () => {
    for (const bad of ['/login/', '/login//', '/login;x=1', '/login/?a=1', '/a/../login', '/./setup', '/setup/', '/LOGIN']) {
      expect(safeReturnUrl(bad), bad).toBe('/library');
    }
    expect(safeReturnUrl('/loginx')).toBe('/loginx'); // a different page
  });
});

describe('webDeviceName', () => {
  it('uses the browser brand, skipping the placeholder brand and the engine name', () => {
    const nav = { userAgentData: { brands: [{ brand: 'Not A;Brand' }, { brand: 'Chromium' }, { brand: 'Google Chrome' }] } };
    expect(webDeviceName(nav as unknown as Navigator)).toBe('Google Chrome');
  });
  it('uses Chromium when it is all there is', () => {
    expect(webDeviceName({ userAgentData: { brands: [{ brand: 'Chromium' }] } } as unknown as Navigator)).toBe('Chromium');
  });
  it('falls back to the user agent string, then to a plain name', () => {
    expect(webDeviceName({ userAgent: 'Mozilla/5.0 (X11) Gecko/20100101 Firefox/130.0' } as Navigator)).toBe('Firefox');
    expect(webDeviceName({ userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17 Safari/605' } as Navigator)).toBe('Safari');
    expect(webDeviceName({ userAgent: 'Mozilla/5.0 Chrome/120 Safari/537 Edg/120' } as Navigator)).toBe('Edge');
    expect(webDeviceName({ userAgent: 'something odd' } as Navigator)).toBe('Web browser');
    expect(webDeviceName({} as Navigator)).toBe('Web browser');
  });
});

describe('problem', () => {
  it('maps the codes a page lists and passes the server text where asked', () => {
    const map = { [Code.Unauthenticated]: 'Invalid email or password', [Code.ResourceExhausted]: fromServer };
    expect(problem(new ConnectError('x', Code.Unauthenticated), map)).toBe('Invalid email or password');
    expect(problem(new ConnectError('try again in 3 s', Code.ResourceExhausted), map)).toBe('try again in 3 s');
  });
  it('shows the server message for a rejected request', () => {
    expect(problem(new ConnectError('device name must be 1 to 100 characters', Code.InvalidArgument), {})).toBe('device name must be 1 to 100 characters');
  });
  it('says the server cannot be reached for network failures and unknown errors', () => {
    expect(problem(new ConnectError('down', Code.Unavailable), {})).toMatch(/could not reach the server/i);
    expect(problem(new Error('boom'), {})).toMatch(/could not reach the server/i);
    expect(problem(new ConnectError('oops', Code.Internal), {})).toMatch(/something went wrong/i);
  });
});
