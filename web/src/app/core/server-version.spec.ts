import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, GetServerInfoResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { TRANSPORT } from './api';
import { COPYRIGHT, ServerVersion } from './server-version';

function setup(info: () => unknown) {
  const calls = { n: 0 };
  const transport = createRouterTransport(({ service }) =>
    service(AuthService, {
      getServerInfo() {
        calls.n++;
        return info() as never;
      },
    }),
  );
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: transport }] });
  return { calls, version: TestBed.inject(ServerVersion) };
}

describe('ServerVersion', () => {
  it('the copyright is the one of the LICENSE file', () => {
    expect(COPYRIGHT).toBe('© 2020 Andrew Loable');
  });

  it('is empty until the server has answered, then the version it reports', async () => {
    const { version } = setup(() => create(GetServerInfoResponseSchema, { version: '1.2.3' }));
    expect(version.version()).toBe('');
    await version.load();
    expect(version.version()).toBe('1.2.3');
  });

  it('asks only once, however often it is asked to load', async () => {
    const { calls, version } = setup(() => create(GetServerInfoResponseSchema, { version: '1.2.3' }));
    await Promise.all([version.load(), version.load()]);
    await version.load();
    expect(calls.n).toBe(1);
  });

  it('a server that does not answer leaves the version empty and says nothing', async () => {
    const { version } = setup(() => {
      throw new ConnectError('down', Code.Unavailable);
    });
    await expect(version.load()).resolves.toBeUndefined();
    expect(version.version()).toBe('');
  });
});
