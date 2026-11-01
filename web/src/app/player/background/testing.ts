import { create, MessageInitShape } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { CatalogService, GetBackgroundResponseSchema } from '../../../gen/kantahe/v1/catalog_pb';
import { Video, VideoSchema } from '../../../gen/kantahe/v1/common_pb';

/** A background video as the server lists it. hasAudio is true: the file carries sound, which must never be played. */
export function bgVideo(id: string, over: MessageInitShape<typeof VideoSchema> = {}): Video {
  return create(VideoSchema, { id, name: id, url: `/media/video/${id}?u=u1&exp=1900000000&sig=sig-${id}`, hasAudio: true, enabled: true, ...over });
}

/** A server that answers GetBackground from what the test sets; the calls are counted. */
export function fakeBackground(videos: Video[] = []) {
  const s = {
    calls: 0,
    enabled: true,
    shuffle: false,
    videos,
    fail: false,
    /** While set, an answer waits for it. */
    gate: undefined as Promise<void> | undefined,
    transport: undefined as unknown as ReturnType<typeof createRouterTransport>,
  };
  s.transport = createRouterTransport(({ service }) => {
    service(CatalogService, {
      async getBackground() {
        s.calls++;
        if (s.gate) await s.gate;
        if (s.fail) throw new ConnectError('down', Code.Unavailable);
        return create(GetBackgroundResponseSchema, { enabled: s.enabled, shuffle: s.shuffle, videos: s.videos });
      },
    });
  });
  return s;
}

/** jsdom plays nothing: the calls are recorded and the test sends the events a browser would. */
export function stubMedia() {
  const played: HTMLMediaElement[] = [];
  const paused: HTMLMediaElement[] = [];
  const loaded: HTMLMediaElement[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    paused.push(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    loaded.push(this);
  });
  return { played, paused, loaded };
}

/** Tells the element how long the video is and how far it is, then sends timeupdate. */
export function at(v: HTMLVideoElement, duration: number, currentTime: number): void {
  Object.defineProperty(v, 'duration', { value: duration, configurable: true });
  Object.defineProperty(v, 'currentTime', { value: currentTime, configurable: true, writable: true });
  v.dispatchEvent(new Event('timeupdate'));
}

export const send = (v: HTMLVideoElement, type: string): boolean => v.dispatchEvent(new Event(type));
