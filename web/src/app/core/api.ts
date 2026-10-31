import { inject, InjectionToken, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { DescService } from '@bufbuild/protobuf';
import { Client, Code, ConnectError, createClient, Interceptor, Transport } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AuthStore } from './auth.store';
import { ServerUrl } from './server-url';

const MUST_CHANGE = 'password change required';

export interface ApiHandlers {
  token: () => string | undefined;
  /** A call that carried a token was refused: the session is over. */
  onUnauthenticated: () => void;
  /** The server wants the password changed before anything else. */
  onPasswordChange: () => void;
}

async function* watch<T>(messages: AsyncIterable<T>, onError: (e: unknown) => void): AsyncGenerator<T> {
  try {
    yield* messages;
  } catch (e) {
    onError(e);
    throw e;
  }
}

/** Adds the bearer token and reports the two errors every page reacts to the same way. */
export function apiInterceptors(h: ApiHandlers): Interceptor[] {
  const bearer: Interceptor = (next) => (req) => {
    const token = h.token();
    if (token) req.header.set('Authorization', `Bearer ${token}`);
    return next(req);
  };
  const errors: Interceptor = (next) => async (req) => {
    const hadToken = req.header.has('Authorization');
    const onError = (e: unknown) => {
      const err = ConnectError.from(e);
      if (hadToken && err.code === Code.Unauthenticated) h.onUnauthenticated();
      else if (err.code === Code.FailedPrecondition && err.rawMessage === MUST_CHANGE) h.onPasswordChange();
    };
    try {
      const res = await next(req);
      return res.stream ? { ...res, message: watch(res.message, onError) } : res;
    } catch (e) {
      onError(e);
      throw e;
    }
  };
  return [bearer, errors];
}

/** The one transport of the app; tests replace it with an in-memory router. */
export const TRANSPORT = new InjectionToken<Transport>('kantahe transport', {
  providedIn: 'root',
  factory: () => {
    const injector = inject(Injector);
    const auth = inject(AuthStore);
    const go = (url: string) => void injector.get(Router).navigateByUrl(url);
    const interceptors = apiInterceptors({
      token: () => auth.token(),
      onUnauthenticated: () => {
        auth.signOut();
        go('/login');
      },
      onPasswordChange: () => {
        auth.markMustChangePassword();
        go('/me/password');
      },
    });
    return followingServerUrl(inject(ServerUrl), (baseUrl) =>
      createConnectTransport({ baseUrl, useBinaryFormat: false, interceptors }),
    );
  },
});

/** A transport that is rebuilt when the stored server address changes (the TV address screen sets it). */
export function followingServerUrl(serverUrl: ServerUrl, make: (baseUrl: string) => Transport): Transport {
  let base: string | undefined;
  let inner: Transport | undefined;
  const current = () => {
    const now = serverUrl.base();
    if (!inner || now !== base) {
      base = now;
      inner = make(now);
    }
    return inner;
  };
  return {
    unary: (...args) => current().unary(...args),
    stream: (...args) => current().stream(...args),
  };
}

/** A typed client of a generated service, for use in an injection context. */
export function injectClient<T extends DescService>(service: T): Client<T> {
  return createClient(service, inject(TRANSPORT));
}
