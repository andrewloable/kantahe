import { TestBed } from '@angular/core/testing';
import { ServerUrl, validServerUrl } from './server-url';

describe('ServerUrl', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to the page origin', () => {
    expect(TestBed.inject(ServerUrl).base()).toBe(window.location.origin);
  });

  it('uses a stored address', () => {
    const s = TestBed.inject(ServerUrl);
    s.set('https://k.example:8443');
    expect(s.base()).toBe('https://k.example:8443');
    expect(localStorage.getItem('kantahe.server')).toBe('https://k.example:8443');
  });

  it('accepts http and https addresses, with a path', () => {
    for (const ok of ['http://192.168.1.5:8080', 'https://k.example', 'https://k.example/sing']) {
      expect(validServerUrl(ok), ok).toBe(true);
    }
  });

  it('rejects anything else', () => {
    for (const bad of [
      '',
      'k.example',
      'ftp://k.example',
      'javascript:alert(1)',
      'https://k.example/',
      'https://k.example/sing/',
      'https://user:pw@k.example',
      'https://k.example?x=1',
      'https://k.example#top',
      ' https://k.example',
    ]) {
      expect(validServerUrl(bad), bad).toBe(false);
    }
  });

  it('set refuses an invalid address and keeps the old one', () => {
    const s = TestBed.inject(ServerUrl);
    s.set('https://a.example');
    expect(() => s.set('https://b.example/')).toThrow();
    expect(s.base()).toBe('https://a.example');
  });

  it('ignores a stored value that is not a valid address', () => {
    localStorage.setItem('kantahe.server', 'javascript:alert(1)');
    expect(TestBed.inject(ServerUrl).base()).toBe(window.location.origin);
  });

  it('clear goes back to the origin', () => {
    const s = TestBed.inject(ServerUrl);
    s.set('https://a.example');
    s.clear();
    expect(s.base()).toBe(window.location.origin);
  });

  it('works when storage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const s = TestBed.inject(ServerUrl);
    expect(s.base()).toBe(window.location.origin);
    expect(() => s.set('https://a.example')).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
