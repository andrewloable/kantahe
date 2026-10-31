/** Messages by field name; a field without a problem has none. */
export type Errors<K extends string> = Partial<Record<K, string>>;

export function fieldValue(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

export function validEmail(raw: string): boolean {
  const e = raw.trim();
  return e.length > 0 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** The server counts bytes: 8 to 256. */
export function passwordLengthOk(pw: string): boolean {
  const n = new TextEncoder().encode(pw).length;
  return n >= 8 && n <= 256;
}

const AFTER_SIGN_IN = '/library';

function hasBadChar(url: string): boolean {
  return [...url].some((c) => c === '\\' || c.charCodeAt(0) < 32);
}

/** Where to go after signing in: a path inside the app, never another site or the sign-in pages. */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\') || hasBadChar(url)) return AFTER_SIGN_IN;
  // resolve "..", "." and repeated slashes the way the router will, then refuse the sign-in pages
  const path = new URL(url, 'http://app.invalid').pathname.replace(/\/{2,}/g, '/');
  return /^\/(login|setup)(?:[;/]|$)/i.test(path) ? AFTER_SIGN_IN : url;
}

/** A readable name for this browser, shown in the user's device list. */
export function webDeviceName(nav: Navigator = navigator): string {
  const brands = (nav as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  const names = brands.map((b) => b.brand).filter((b) => !/not.?a.?brand/i.test(b));
  const named = names.find((b) => b !== 'Chromium') ?? names[0];
  if (named) return named.slice(0, 100);
  const ua = nav.userAgent ?? '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Web browser';
}

export { fromServer, problem } from '../core/errors';
