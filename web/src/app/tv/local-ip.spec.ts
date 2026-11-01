import { localIpv4, privateIpv4 } from './local-ip';

/** What the webOS service bridge does: the callback gets the JSON answer of the service. */
function bridge(answer: unknown | 'never' | 'throws') {
  return class {
    onservicecallback: ((msg: string) => void) | null = null;
    call(uri: string): void {
      expect(uri).toBe('luna://com.palm.connectionmanager/getStatus');
      if (answer === 'throws') throw new Error('no service');
      if (answer !== 'never') queueMicrotask(() => this.onservicecallback?.(JSON.stringify(answer)));
    }
    cancel(): void {
      /* nothing to stop */
    }
  };
}

describe('privateIpv4', () => {
  it('accepts the three private ranges and nothing else', () => {
    for (const ok of ['10.0.0.5', '192.168.1.37', '172.16.0.1', '172.31.255.254']) expect(privateIpv4(ok), ok).toBe(ok);
    for (const no of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '127.0.0.1', '169.254.1.1', '192.168.1', '192.168.1.1.1', '', 'fe80::1', undefined, null, 5]) {
      expect(privateIpv4(no), String(no)).toBeUndefined();
    }
  });

  it('refuses octets above 255', () => {
    expect(privateIpv4('192.168.1.300')).toBeUndefined();
  });
});

describe('localIpv4', () => {
  it('a Samsung TV: webapis.network.getIp()', async () => {
    expect(await localIpv4({ webapis: { network: { getIp: () => '192.168.1.37' } } })).toBe('192.168.1.37');
  });

  it('a Samsung TV whose call throws (no privilege): nothing', async () => {
    const getIp = () => {
      throw new Error('SecurityError');
    };
    expect(await localIpv4({ webapis: { network: { getIp } } })).toBeUndefined();
  });

  it('a public or empty answer from the Samsung call is not used', async () => {
    expect(await localIpv4({ webapis: { network: { getIp: () => '8.8.8.8' } } })).toBeUndefined();
    expect(await localIpv4({ webapis: { network: { getIp: () => '' } } })).toBeUndefined();
  });

  it('an LG TV on a cable: the wired address', async () => {
    const answer = { wired: { state: 'connected', ipAddress: '192.168.1.40' }, wifi: { state: 'connected', ipAddress: '192.168.1.41' } };
    expect(await localIpv4({ PalmServiceBridge: bridge(answer) })).toBe('192.168.1.40');
  });

  it('an LG TV on wifi: the wifi address when the cable is not connected', async () => {
    const answer = { wired: { state: 'disconnected' }, wifi: { state: 'connected', ipAddress: '192.168.1.41' } };
    expect(await localIpv4({ PalmServiceBridge: bridge(answer) })).toBe('192.168.1.41');
  });

  it('an LG TV that is not connected at all: nothing', async () => {
    expect(await localIpv4({ PalmServiceBridge: bridge({ wired: { state: 'disconnected' }, wifi: { state: 'disconnected' } }) })).toBeUndefined();
  });

  it('an LG TV whose service throws, or answers with something else: nothing', async () => {
    expect(await localIpv4({ PalmServiceBridge: bridge('throws') })).toBeUndefined();
    expect(await localIpv4({ PalmServiceBridge: bridge('not an object') })).toBeUndefined();
  });

  it('an LG TV whose service never answers: nothing, after 2 seconds', async () => {
    vi.useFakeTimers();
    try {
      const result = localIpv4({ PalmServiceBridge: bridge('never') });
      await vi.advanceTimersByTimeAsync(2000);
      expect(await result).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('neither platform: nothing (a browser)', async () => {
    expect(await localIpv4({})).toBeUndefined();
  });
});
