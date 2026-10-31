import { TestBed } from '@angular/core/testing';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { Environment } from '../../environments/environment.model';
import { ENVIRONMENT } from '../core/environment';
import { BACK_ACTIONS } from './back-keys';
import { provideTv } from './provide-tv';

const keydown = (init: KeyboardEventInit & { keyCode?: number }) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, 'keyCode', { value: init.keyCode });
  document.dispatchEvent(e);
  return e;
};

function start(env: Environment) {
  const back = vi.fn();
  TestBed.configureTestingModule({
    providers: [provideTv(), { provide: ENVIRONMENT, useValue: env }, { provide: BACK_ACTIONS, useValue: { back, exit: vi.fn(), canGoBack: () => true } }],
  });
  TestBed.inject(ENVIRONMENT); // the app initializers run with the first injection
  return { back };
}

describe('provideTv', () => {
  afterEach(() => document.documentElement.classList.remove('tv'));

  it('on a TV build: marks the page, and the remote keys work', () => {
    const { back } = start({ isTv: true, tvDeviceType: DeviceType.TIZEN });
    expect(document.documentElement.classList.contains('tv')).toBe(true);
    keydown({ keyCode: 10009 });
    expect(back).toHaveBeenCalledTimes(1);
    const a = document.createElement('button');
    const b = document.createElement('button');
    document.body.append(a, b);
    for (const [el, top] of [[a, 0], [b, 80]] as const) el.getBoundingClientRect = () => ({ left: 0, top, width: 100, height: 50, x: 0, y: top, right: 100, bottom: top + 50, toJSON: () => ({}) });
    a.focus();
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(b);
    a.remove();
    b.remove();
  });

  it('on the web build: nothing is attached', () => {
    const { back } = start({ isTv: false, tvDeviceType: DeviceType.UNSPECIFIED });
    expect(document.documentElement.classList.contains('tv')).toBe(false);
    keydown({ keyCode: 10009 });
    expect(back).not.toHaveBeenCalled();
  });
});
