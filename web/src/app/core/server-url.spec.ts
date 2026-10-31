import { TestBed } from '@angular/core/testing';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { ENVIRONMENT } from './environment';
import { normalizeServerUrl, ServerUrl, validServerUrl } from './server-url';

const TV: Environment = { isTv: true, tvDeviceType: DeviceType.TIZEN };

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

describe('ServerUrl on a web build', () => {
  it('always has an address: the page origin', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(true);
  });
});

describe('ServerUrl on a TV build', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: ENVIRONMENT, useValue: TV }] });
  });

  it('has no address until one is stored, and never falls back to the page (a packaged app has no server there)', () => {
    const s = TestBed.inject(ServerUrl);
    expect(s.hasAddress()).toBe(false);
    expect(s.base()).toBe('');
  });

  it('has the stored address once it is set', () => {
    const s = TestBed.inject(ServerUrl);
    s.set('http://192.168.1.20:8080');
    expect(s.hasAddress()).toBe(true);
    expect(s.base()).toBe('http://192.168.1.20:8080');
  });

  it('does not take a stored value that is not an address', () => {
    localStorage.setItem('kantahe.server', 'javascript:alert(1)');
    expect(TestBed.inject(ServerUrl).hasAddress()).toBe(false);
  });

  it('clear forgets it again', () => {
    const s = TestBed.inject(ServerUrl);
    s.set('http://a.example');
    s.clear();
    expect(s.hasAddress()).toBe(false);
  });
});

describe('normalizeServerUrl', () => {
  it('adds http when the scheme is missing and drops trailing slashes', () => {
    expect(normalizeServerUrl('192.168.1.20:8080')).toBe('http://192.168.1.20:8080');
    expect(normalizeServerUrl('  https://k.example/  ')).toBe('https://k.example');
    expect(normalizeServerUrl('http://k.example/sing//')).toBe('http://k.example/sing');
  });

  it('refuses what is not an address', () => {
    for (const bad of ['', '   ', 'http://', 'ftp://k.example', 'http://user:pw@k.example', 'http://k.example?x=1', 'http://k.example#a', 'http://k .example', 'javascript:alert(1)']) {
      expect(normalizeServerUrl(bad), bad).toBeUndefined();
    }
  });
});
