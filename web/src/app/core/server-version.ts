import { Injectable, signal } from '@angular/core';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { injectClient } from './api';

/** The copyright of the footer: the holder and year of the LICENSE file. The Flutter app shows the same text (app/lib/core/brand.dart). */
export const COPYRIGHT = '© 2020 Andrew Loable';

/** The version of the server this page came from, for the footer. Asked once; a server that does not answer leaves it empty. */
@Injectable({ providedIn: 'root' })
export class ServerVersion {
  private readonly client = injectClient(AuthService);
  private asked?: Promise<void>;

  /** '' until the server has answered (or when it never does). */
  readonly version = signal('');

  load(): Promise<void> {
    this.asked ??= this.client.getServerInfo({}).then(
      (info) => this.version.set(info.version),
      () => undefined, // the footer shows the copyright alone: nothing to tell the user about
    );
    return this.asked;
  }
}
