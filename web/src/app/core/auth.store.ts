import { computed, Injectable, signal } from '@angular/core';
import { create } from '@bufbuild/protobuf';
import { AuthToken, User, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { readStore, removeStore, writeStore } from './storage';

const TOKEN = 'kantahe.token';
const DEVICE = 'kantahe.deviceId';

/** The signed-in device: its bearer token and id are kept in storage, the user is loaded on demand. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly token = signal<string | undefined>(readStore(TOKEN));
  readonly deviceId = signal<string | undefined>(readStore(DEVICE));
  readonly user = signal<User | undefined>(undefined);
  /** The server refuses everything but a password change; true even while the user is not loaded. */
  readonly passwordChangeRequired = signal(false);
  readonly signedIn = computed(() => this.token() !== undefined);

  signIn(auth: AuthToken): void {
    this.token.set(auth.token);
    this.deviceId.set(auth.deviceId);
    this.user.set(auth.user);
    this.passwordChangeRequired.set(auth.user?.mustChangePassword ?? false);
    writeStore(TOKEN, auth.token);
    writeStore(DEVICE, auth.deviceId);
  }

  /** A session handed over by an app that keeps the token itself: nothing is written to storage. */
  setSession(token: string, deviceId: string): void {
    this.token.set(token);
    this.deviceId.set(deviceId);
    this.user.set(undefined);
    this.passwordChangeRequired.set(false);
  }

  signOut(): void {
    this.token.set(undefined);
    this.deviceId.set(undefined);
    this.user.set(undefined);
    this.passwordChangeRequired.set(false);
    removeStore(TOKEN);
    removeStore(DEVICE);
  }

  setUser(user: User | undefined): void {
    this.user.set(user);
    if (user) this.passwordChangeRequired.set(user.mustChangePassword);
  }

  /** The password was changed: the server accepts everything again. */
  passwordChanged(): void {
    this.passwordChangeRequired.set(false);
    const u = this.user();
    if (u?.mustChangePassword) this.user.set(create(UserSchema, { ...u, mustChangePassword: false }));
  }

  /** The server refused a call until the password is changed. */
  markMustChangePassword(): void {
    this.passwordChangeRequired.set(true);
    const u = this.user();
    if (u) this.user.set(create(UserSchema, { ...u, mustChangePassword: true }));
  }
}
