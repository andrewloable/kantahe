import { Code, ConnectError } from '@connectrpc/connect';

/** In a code map: show the text the server sent. */
export const fromServer = Symbol('server text');

/** The sentence to show for a failed call: what the page says for that code, else a general one. */
export function problem(err: unknown, byCode: Partial<Record<Code, string | symbol>>): string {
  const e = ConnectError.from(err);
  const mapped = byCode[e.code];
  if (mapped === fromServer) return e.rawMessage;
  if (typeof mapped === 'string') return mapped;
  if (e.code === Code.InvalidArgument) return e.rawMessage;
  if (e.code === Code.Unavailable || e.code === Code.Unknown || e.code === Code.DeadlineExceeded) {
    return 'Could not reach the server. Check the connection and try again.';
  }
  return 'Something went wrong. Try again.';
}
