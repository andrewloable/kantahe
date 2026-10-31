import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { AuthStore } from './auth.store';

function token(t = 'tok', device = 'dev1', email = 'a@example.com') {
  return create(AuthTokenSchema, { token: t, deviceId: device, user: create(UserSchema, { email, admin: true }) });
}

describe('AuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts signed out', () => {
    const s = TestBed.inject(AuthStore);
    expect(s.token()).toBeUndefined();
    expect(s.signedIn()).toBe(false);
  });

  it('signIn keeps and persists the token and device id', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(token());
    expect(s.token()).toBe('tok');
    expect(s.deviceId()).toBe('dev1');
    expect(s.user()?.email).toBe('a@example.com');
    expect(s.signedIn()).toBe(true);
    expect(localStorage.getItem('kantahe.token')).toBe('tok');
    expect(localStorage.getItem('kantahe.deviceId')).toBe('dev1');
  });

  it('reads the persisted token on creation (the user is not persisted)', () => {
    localStorage.setItem('kantahe.token', 'saved');
    localStorage.setItem('kantahe.deviceId', 'd9');
    const s = TestBed.inject(AuthStore);
    expect(s.token()).toBe('saved');
    expect(s.deviceId()).toBe('d9');
    expect(s.user()).toBeUndefined();
  });

  it('signOut clears memory and storage', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(token());
    s.signOut();
    expect(s.token()).toBeUndefined();
    expect(s.deviceId()).toBeUndefined();
    expect(s.user()).toBeUndefined();
    expect(localStorage.getItem('kantahe.token')).toBeNull();
    expect(localStorage.getItem('kantahe.deviceId')).toBeNull();
  });

  it('signIn without a user (a token reply is always meant to have one) keeps the old user unset', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    expect(s.token()).toBe('t');
    expect(s.user()).toBeUndefined();
  });

  it('setUser replaces the user, markMustChangePassword flags it', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(token());
    s.markMustChangePassword();
    expect(s.user()?.mustChangePassword).toBe(true);
    s.setUser(create(UserSchema, { email: 'b@example.com' }));
    expect(s.user()?.email).toBe('b@example.com');
    expect(s.user()?.mustChangePassword).toBe(false);
  });

  it('markMustChangePassword without a user creates no user but is remembered', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    s.markMustChangePassword();
    expect(s.user()).toBeUndefined();
    expect(s.passwordChangeRequired()).toBe(true);
  });

  it('the password-change flag follows the user, sign-in and sign-out', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { mustChangePassword: true }) }));
    expect(s.passwordChangeRequired()).toBe(true);
    s.setUser(create(UserSchema, { mustChangePassword: false }));
    expect(s.passwordChangeRequired()).toBe(false);
    s.markMustChangePassword();
    s.signOut();
    expect(s.passwordChangeRequired()).toBe(false);
    s.signIn(token());
    expect(s.passwordChangeRequired()).toBe(false);
  });

  it('passwordChanged clears the requirement and the user flag', () => {
    const s = TestBed.inject(AuthStore);
    s.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { email: 'a@example.com', mustChangePassword: true }) }));
    s.passwordChanged();
    expect(s.passwordChangeRequired()).toBe(false);
    expect(s.user()?.mustChangePassword).toBe(false);
    expect(s.user()?.email).toBe('a@example.com');
  });

  it('passwordChanged without a loaded user only clears the requirement', () => {
    const s = TestBed.inject(AuthStore);
    s.markMustChangePassword();
    s.passwordChanged();
    expect(s.passwordChangeRequired()).toBe(false);
    expect(s.user()).toBeUndefined();
  });

  it('setSession keeps the token and device id in memory only', () => {
    const s = TestBed.inject(AuthStore);
    s.setSession('mem-token', 'dev9');
    expect(s.token()).toBe('mem-token');
    expect(s.deviceId()).toBe('dev9');
    expect(s.signedIn()).toBe(true);
    expect(localStorage.getItem('kantahe.token')).toBeNull();
    expect(localStorage.getItem('kantahe.deviceId')).toBeNull();
    s.signOut();
    expect(s.token()).toBeUndefined();
  });

  it('does not break when storage throws', () => {
    const bad = () => {
      throw new Error('denied');
    };
    const g = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bad);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bad);
    const rm = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(bad);
    const s = TestBed.inject(AuthStore);
    expect(() => s.signIn(token())).not.toThrow();
    expect(s.token()).toBe('tok');
    expect(() => s.signOut()).not.toThrow();
    expect(s.token()).toBeUndefined();
    g.mockRestore();
    set.mockRestore();
    rm.mockRestore();
  });
});
