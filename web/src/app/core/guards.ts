import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { injectClient } from './api';
import { AuthStore } from './auth.store';
import { ENVIRONMENT } from './environment';
import { ServerUrl } from './server-url';

/** Loads the signed-in user after a page reload; 'refused' when the server no longer accepts the token. */
async function ensureUser(auth: AuthStore, load: () => Promise<void>): Promise<'ok' | 'refused' | 'unknown'> {
  if (auth.user()) return 'ok';
  try {
    await load();
    return auth.user() ? 'ok' : 'unknown';
  } catch (e) {
    return ConnectError.from(e).code === Code.Unauthenticated ? 'refused' : 'unknown';
  }
}

/** /login, remembering the page that was asked for so the sign-in can return to it. */
function toLogin(router: Router, state: RouterStateSnapshot): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
}

function userLoader() {
  const auth = inject(AuthStore);
  const client = injectClient(AuthService);
  return { auth, load: async () => auth.setUser((await client.me({})).user) };
}

/** Needs a token. The user is loaded once per page load; an unreachable server does not lock anyone out. */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const { auth, load } = userLoader();
  if (!auth.token()) return toLogin(router, state);
  if ((await ensureUser(auth, load)) === 'refused') return toLogin(router, state);
  // nothing but the password change is open until it is done
  const onPasswordPage = state.url.split(/[?#]/, 1)[0] === '/me/password';
  return auth.passwordChangeRequired() && !onPasswordPage ? router.parseUrl('/me/password') : true;
};

/** Needs an administrator; anybody else lands in the library. */
export const adminGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const { auth, load } = userLoader();
  if (!auth.token()) return toLogin(router, state);
  const known = await ensureUser(auth, load);
  if (known === 'refused') return toLogin(router, state);
  if (auth.passwordChangeRequired()) return router.parseUrl('/me/password');
  return auth.user()?.admin ? true : router.parseUrl('/library');
};

/** While the first admin is missing every page is replaced by /setup. */
export const setupGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const client = injectClient(AuthService);
  try {
    return (await client.getServerInfo({})).setupRequired ? router.parseUrl('/setup') : true;
  } catch {
    return true; // the page itself shows that the server cannot be reached
  }
};

/** Uploading is for users with the uploader role, and for administrators. */
export const uploaderGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const { auth, load } = userLoader();
  if (!auth.token()) return toLogin(router, state);
  if ((await ensureUser(auth, load)) === 'refused') return toLogin(router, state);
  const u = auth.user();
  return u?.uploader || u?.admin ? true : router.parseUrl('/library');
};

/** A packaged TV app has no server of its own: until its address is typed in, every page is the address page. */
export const serverGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  if (!inject(ENVIRONMENT).isTv || inject(ServerUrl).hasAddress()) return true;
  return inject(Router).createUrlTree(['/server'], { queryParams: { returnUrl: state.url } });
};
