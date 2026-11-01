import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_URL } from '../ports';

// The data the audit looks at, put on a scratch server through its own API. It is the same on every run (the songs come from
// kantahe-fixtures, the names are fixed), and nothing in it is a real person: every address ends in example.com.

export interface Account {
  email: string;
  password: string;
  token: string;
  deviceId: string;
  /** A second device of the account (scratch accounts only): it takes the player role, so that the browser's device is never the player at the start of a state. */
  remoteToken?: string;
}

export interface Seed {
  /** The administrator: nothing of their own, so that every page of theirs shows its empty state. */
  admin: Account;
  /** Una: a library's worth of favourites, history, playlists and a queue; the audit only reads what is hers. */
  user: Account;
  /** One account per worker for what changes while the audit runs: toasts, the player, codes. */
  scratch: Account[];
  numbers: {
    /** An MP3 with a title of 90 characters, one with an artist of 90, and one with both. */
    longTitle: string;
    longArtist: string;
    longBoth: string;
    /** A title that is one word of 45 letters, which has no place to break. */
    unbroken: string;
  };
  /** The words every long title starts with, for a search that finds exactly them. */
  longQuery: string;
  playlists: { many: string; long: string; empty: string };
}

/** The most workers the audit uses: each needs an account of its own for what changes. */
export const MAX_WORKERS = 8;
export const workerCount = (): number => Math.min(Math.max(Number(process.env['KANTAHE_AUDIT_WORKERS'] ?? 4) || 4, 1), MAX_WORKERS);

export const PASSWORD = 'audit-password-1';
const TEMPORARY = 'audit-temporary-1';

type Json = Record<string, unknown>;

/** One ConnectRPC call over JSON, as the browser makes it. */
export async function rpc<T = Json>(service: string, method: string, body: Json, token?: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}/kantahe.v1.${service}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${service}/${method} answered ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

interface AuthReply {
  auth: { token: string; deviceId: string };
}

interface SongRow {
  number: string;
  format: string;
  title: string;
}

const device = (name: string, type: string) => ({ deviceName: name, deviceType: type });

/** A user the administrator creates, who signs in once to replace the temporary password and keeps that first device. */
async function newUser(admin: string, email: string, name: string, uploader: boolean, deviceName: string): Promise<Account> {
  await rpc('AdminService', 'CreateUser', { email, displayName: name, temporaryPassword: TEMPORARY, uploader }, admin);
  const first = await rpc<AuthReply>('AuthService', 'Login', { email, password: TEMPORARY, ...device(deviceName, 'DEVICE_TYPE_WEB') });
  await rpc('AuthService', 'ChangePassword', { currentPassword: TEMPORARY, newPassword: PASSWORD }, first.auth.token);
  return { email, password: PASSWORD, token: first.auth.token, deviceId: first.auth.deviceId };
}

async function allSongs(token: string): Promise<SongRow[]> {
  const songs: SongRow[] = [];
  for (let page = ''; ; ) {
    const r = await rpc<{ songs?: SongRow[]; nextPageToken?: string }>('CatalogService', 'SearchSongs', { pageSize: 100, pageToken: page }, token);
    songs.push(...(r.songs ?? []));
    if (!r.nextPageToken) return songs;
    page = r.nextPageToken;
  }
}

const words = (n: number) => 'Longtitle of a most wonderful song with a name that goes on and on and on and on and on and on'.slice(0, n).padEnd(n, '.');

/**
 * Fills the server: songs (some with very long titles), users, three playlists, favourites, history with scores and skips,
 * a queue and three devices. `workers` is how many accounts the audit's workers need for what they change; `tvToken` is the token
 * of the TV, which holdOnline() keeps connected.
 */
export async function seedServer(workers: number, library: string): Promise<{ seed: Seed; tvToken: string }> {
  const setup = await rpc<AuthReply>('AuthService', 'Setup', { email: 'admin@example.com', password: PASSWORD, displayName: 'Admin', ...device('Admin laptop', 'DEVICE_TYPE_WEB') });
  const admin: Account = { email: 'admin@example.com', password: PASSWORD, token: setup.auth.token, deviceId: setup.auth.deviceId };

  // the server scans its folder in the background; the admin's rescan returns when it has seen every file
  await rpc('AdminService', 'Rescan', {}, admin.token);
  let songs = await allSongs(admin.token);
  for (let wait = 0; songs.length < 300 && wait < 60; wait++) {
    await new Promise((r) => setTimeout(r, 1000)); // the first scan, which the server starts by itself, may still be running
    songs = await allSongs(admin.token);
  }
  if (songs.length < 300) throw new Error(`Only ${songs.length} songs were found, 300 are needed`);

  // very long text in the songs: a title, an artist, both, and a word with no place to break
  const mp3 = songs.filter((s) => s.format === 'FORMAT_MP3');
  const [t, a, both, unbroken] = mp3.slice(2, 6);
  const edit = (s: SongRow, title?: string, artist?: string) => rpc('AdminService', 'UpdateSong', { number: s.number, title, artist }, admin.token);
  await edit(t, words(90), undefined);
  await edit(a, undefined, words(90).replace('Longtitle', 'Longartist'));
  await edit(both, words(88).replace('Longtitle', 'Longtitle both'), words(88).replace('Longtitle', 'Longartist'));
  await edit(unbroken, 'Longtitle' + 'Supercalifragilisticexpialidocious'.slice(0, 36), 'Unbroken');
  songs = await allSongs(admin.token);

  // users: Una has the data; the other has an address of 60 characters and a long name; the scratch accounts are for the workers
  const user = await newUser(admin.token, 'una@example.com', 'Una', false, "Una's laptop");
  await newUser(admin.token, 'a-very-long-address-for-testing-the-layout-of-lists@example.com', 'Doña María de los Ángeles Fernández-Villaverde y Castellanos de la Vega', true, 'Phone');
  const scratch: Account[] = [];
  for (let i = 1; i <= workers; i++) {
    const account = await newUser(admin.token, `scratch${i}@example.com`, `Scratch ${i}`, false, `Scratch ${i} browser`);
    const remote = await rpc<AuthReply>('AuthService', 'Login', { email: account.email, password: PASSWORD, ...device(`Scratch ${i} remote`, 'DEVICE_TYPE_WEB') });
    scratch.push({ ...account, remoteToken: remote.auth.token });
  }

  // Una's devices: the laptop of her first sign-in (the browser uses it), a TV that is connected, a phone that is not
  const tv = await rpc<AuthReply>('AuthService', 'Login', { email: user.email, password: PASSWORD, ...device('Living room TV', 'DEVICE_TYPE_ANDROID_TV') });
  await rpc('AuthService', 'Login', { email: user.email, password: PASSWORD, ...device("Una's old phone with a long name", 'DEVICE_TYPE_ANDROID') });

  const ut = user.token;
  const numbers = songs.map((s) => s.number);
  const longNumbers = [t, a, both, unbroken].map((s) => s.number);

  // favourites: 60, the long ones among them
  for (const n of [...longNumbers, ...numbers.slice(0, 56)]) await rpc('UserLibraryService', 'SetFavourite', { number: n, favourite: true }, ut);

  // three playlists: sixty songs, a long name with four songs, none
  const many = await rpc<{ playlist: { id: string } }>('UserLibraryService', 'CreatePlaylist', { name: 'Party mix', numbers: [...longNumbers, ...numbers.slice(10, 66)] }, ut);
  const long = await rpc<{ playlist: { id: string } }>('UserLibraryService', 'CreatePlaylist', { name: 'The songs we sing at every family gathering when everybody has had a little too much cake', numbers: longNumbers }, ut);
  const empty = await rpc<{ playlist: { id: string } }>('UserLibraryService', 'CreatePlaylist', { name: 'Empty', numbers: [] }, ut);

  // history: four songs sung to the end with a score, then fifty skipped (a page of fifty and more)
  const queued = [...longNumbers, ...numbers.slice(70, 124)];
  for (const n of queued) await rpc('SessionService', 'AddToQueue', { number: n }, ut);
  const control = (action: string) => rpc('SessionService', 'Control', { action }, ut);
  await control('CONTROL_ACTION_PLAY_HERE');
  for (const n of queued.slice(0, 4)) {
    await rpc('SessionService', 'Ready', { number: n }, ut);
    await rpc('SessionService', 'Ended', { number: n, loudReadings: 0 }, ut);
    await control('CONTROL_ACTION_SKIP'); // leaves the score screen and loads the next song
  }
  for (let i = 0; i < 50; i++) await control('CONTROL_ACTION_SKIP');
  await control('CONTROL_ACTION_PAUSE');
  // a queue of thirty
  for (const n of numbers.slice(130, 160)) await rpc('SessionService', 'AddToQueue', { number: n }, ut);

  // six songs whose files are gone, found by a check of the library (Admin > Songs shows them under "Check the library"); the last
  // MIDI songs, which nothing above uses
  for (const file of readdirSync(library).filter((f) => f.endsWith('.kar')).sort().slice(-6)) rmSync(join(library, file));
  await checkLibrary(admin.token);

  const seed: Seed = {
    admin,
    user,
    scratch,
    numbers: { longTitle: t.number, longArtist: a.number, longBoth: both.number, unbroken: unbroken.number },
    longQuery: 'Longtitle',
    playlists: { many: many.playlist.id, long: long.playlist.id, empty: empty.playlist.id },
  };
  return { seed, tvToken: tv.auth.token };
}

/** Runs CheckLibrary as the administrator and waits for the end of its stream. */
async function checkLibrary(token: string): Promise<void> {
  const message = Buffer.from('{}');
  const envelope = Buffer.concat([Buffer.from([0, 0, 0, 0, message.length]), message]);
  const res = await fetch(`${SERVER_URL}/kantahe.v1.AdminService/CheckLibrary`, {
    method: 'POST',
    headers: { 'content-type': 'application/connect+json', 'connect-protocol-version': '1', authorization: `Bearer ${token}` },
    body: envelope,
  });
  const end = await res.text();
  if (!res.ok || end.includes('"error"')) throw new Error(`CheckLibrary failed: ${res.status} ${end.slice(0, 200)}`);
}

/** Keeps the TV of Una's list "online": a device is online while it has a WatchState stream open. Returns the function that closes it. */
export async function holdOnline(token: string): Promise<() => void> {
  const stop = new AbortController();
  const message = Buffer.from('{}');
  const envelope = Buffer.concat([Buffer.from([0, 0, 0, 0, message.length]), message]);
  const res = await fetch(`${SERVER_URL}/kantahe.v1.SessionService/WatchState`, {
    method: 'POST',
    headers: { 'content-type': 'application/connect+json', 'connect-protocol-version': '1', authorization: `Bearer ${token}` },
    body: envelope,
    signal: stop.signal,
  });
  if (!res.ok || !res.body) throw new Error(`WatchState answered ${res.status}`);
  const reader = res.body.getReader();
  void (async () => {
    try {
      for (;;) if ((await reader.read()).done) return;
    } catch {
      // closed on purpose
    }
  })();
  return () => stop.abort();
}

export function writeSeed(path: string, seed: Seed): void {
  writeFileSync(path, JSON.stringify(seed, null, 2));
}
