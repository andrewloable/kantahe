/** What the TV platforms put on the page; tests pass their own. */
export interface PlatformGlobals {
  /** Samsung (Tizen): loaded from $WEBAPIS/webapis/webapis.js, needs the network.public privilege. */
  webapis?: { network?: { getIp?: () => string } };
  /** LG (webOS): the bridge to the platform's services. */
  PalmServiceBridge?: new () => { onservicecallback: ((message: string) => void) | null; call(uri: string, params: string): void; cancel?(): void };
}

const ANSWER_WITHIN_MS = 2000;

/** The address when it is a private IPv4 address (10/8, 172.16/12, 192.168/16), else undefined. */
export function privateIpv4(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!m) return undefined;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return undefined;
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  return isPrivate ? value : undefined;
}

/** The webOS answer: the cable's address when it is connected, else the wifi one. */
function fromWebos(message: string): string | undefined {
  try {
    const status = JSON.parse(message) as { wired?: { state?: string; ipAddress?: string }; wifi?: { state?: string; ipAddress?: string } };
    const wired = status.wired?.state === 'connected' ? privateIpv4(status.wired.ipAddress) : undefined;
    return wired ?? (status.wifi?.state === 'connected' ? privateIpv4(status.wifi.ipAddress) : undefined);
  } catch {
    return undefined;
  }
}

/**
 * The TV's own IPv4 address on the local network, from the platform: Samsung's webapis.network.getIp(), or LG's
 * connection manager (luna://com.palm.connectionmanager/getStatus). undefined when there is no such platform, the
 * call fails or does not answer within 2 seconds, or the address is not a private one.
 */
export async function localIpv4(platform: PlatformGlobals = globalThis as PlatformGlobals): Promise<string | undefined> {
  const getIp = platform.webapis?.network?.getIp;
  if (getIp) {
    try {
      return privateIpv4(getIp.call(platform.webapis?.network));
    } catch {
      return undefined; // no privilege, or the call is not there on this model
    }
  }
  const Bridge = platform.PalmServiceBridge;
  if (!Bridge) return undefined;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ANSWER_WITHIN_MS);
    try {
      const bridge = new Bridge();
      bridge.onservicecallback = (message) => {
        clearTimeout(timer);
        bridge.cancel?.();
        resolve(fromWebos(message));
      };
      bridge.call('luna://com.palm.connectionmanager/getStatus', '{}');
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}
