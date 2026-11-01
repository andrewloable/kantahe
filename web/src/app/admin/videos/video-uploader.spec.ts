import { Code, ConnectError } from '@connectrpc/connect';
import { UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { bigFile, fakeVideoServer, listed, memoryStore, MIB } from './testing';
import { uploadVideo } from './video-uploader';

const instant = () => Promise.resolve();

describe('uploadVideo', () => {
  afterEach(() => vi.useRealTimers());

  it('sends a 10 MiB file in chunks of the size the server named, at the right offsets, then completes; progress reaches 100%', async () => {
    const s = fakeVideoServer();
    const progress: number[] = [];
    const res = await uploadVideo(s.uploadClient, bigFile('beach.mp4', 10 * MIB), { store: memoryStore(), onProgress: (got, total) => progress.push(Math.round((got / total) * 100)) });
    expect(s.calls.chunks.map((c) => [c.offset, c.size])).toEqual([
      [0, 4 * MIB],
      [4 * MIB, 4 * MIB],
      [8 * MIB, 2 * MIB],
    ]);
    expect(s.calls.complete).toEqual(['up1']);
    expect(s.calls.begin).toEqual([{ filename: 'beach.mp4', sizeBytes: BigInt(10 * MIB) }]);
    expect(res.status).toBe('added');
    expect(progress.at(-1)).toBe(100);
  });

  it('resumes from what the server already has', async () => {
    const s = fakeVideoServer({ script: { received: 4 * MIB } });
    const resumed: number[] = [];
    const res = await uploadVideo(s.uploadClient, bigFile('beach.mp4', 10 * MIB), { store: memoryStore(), onResume: (got) => resumed.push(got) });
    expect(s.calls.chunks[0].offset).toBe(4 * MIB);
    expect(s.calls.chunks).toHaveLength(2);
    expect(resumed).toEqual([4 * MIB]);
    expect(res.status).toBe('added');
  });

  it('a network failure on a chunk succeeds on the retry, after 500 ms', async () => {
    const waits: number[] = [];
    const s = fakeVideoServer({ script: { failAt: new Map([[2, new ConnectError('down', Code.Unavailable)]]) } });
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), sleep: async (ms) => void waits.push(ms) });
    expect(res.status).toBe('added');
    expect(waits).toEqual([500]);
    expect(s.calls.chunks.map((c) => c.offset)).toEqual([0, 4 * MIB, 4 * MIB, 8 * MIB]);
  });

  it('four failures of one chunk end the upload in an error and nothing else is sent', async () => {
    const waits: number[] = [];
    const down = new ConnectError('down', Code.Unavailable);
    const s = fakeVideoServer({ script: { failAt: new Map([[2, down], [3, down], [4, down], [5, down]]) } });
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), sleep: async (ms) => void waits.push(ms) });
    expect(res.status).toBe('failed');
    expect(waits, 'waits of 500 ms, 1 s and 2 s').toEqual([500, 1000, 2000]);
    expect(s.calls.chunks).toHaveLength(5); // the first chunk, and the second four times
    expect(s.calls.complete).toEqual([]);
  });

  it('a refused offset (a chunk whose answer was lost) asks the server where it is and goes on from there', async () => {
    // chunk 2 is stored but its answer is lost; the retry at the old offset is refused with FAILED_PRECONDITION
    const s = fakeVideoServer({ script: { loseAnswerAt: [2] } });
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), sleep: instant });
    expect(res.status).toBe('added');
    expect(s.calls.chunks.map((c) => c.offset)).toEqual([0, 4 * MIB, 4 * MIB, 8 * MIB]);
    expect(s.calls.begin, 'begin was called again to resync').toHaveLength(2);
    expect(s.calls.complete).toEqual(['up1']);
  });

  it('an error that a retry cannot cure (a lowered limit) ends it at once', async () => {
    const s = fakeVideoServer({ script: { failAt: new Map([[2, new ConnectError('larger than the limit of 5 MB', Code.InvalidArgument)]]) } });
    const waits: number[] = [];
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), sleep: async (ms) => void waits.push(ms) });
    expect(res).toEqual({ status: 'failed', reason: 'larger than the limit of 5 MB' });
    expect(waits).toEqual([]);
    expect(s.calls.chunks).toHaveLength(2);
  });

  it('abort during a chunk: the upload is thrown away on the server once and no further chunk is sent', async () => {
    const s = fakeVideoServer({ script: { hangAt: [2] } });
    const ac = new AbortController();
    const store = memoryStore();
    const pending = uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store, signal: ac.signal, sleep: instant });
    await vi.waitFor(() => expect(s.calls.chunks).toHaveLength(2));
    ac.abort();
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(s.calls.abort).toEqual(['up1']);
    expect(s.calls.chunks).toHaveLength(2);
    expect(s.calls.complete).toEqual([]);
    expect(store.data, 'nothing is left to resume').toEqual({});
  });

  it('a file the server refuses at the start is a result with the reason, and no chunk is sent', async () => {
    const s = fakeVideoServer({ script: { reject: 'larger than the limit of 500 MB' } });
    const res = await uploadVideo(s.uploadClient, bigFile('huge.mp4', 10 * MIB), { store: memoryStore() });
    expect(res).toEqual({ status: 'refused', reason: 'larger than the limit of 500 MB' });
    expect(s.calls.chunks).toEqual([]);
  });

  it('a file the server refuses at the end (HEVC, say) is a result with the reason', async () => {
    const s = fakeVideoServer({ script: { complete: { status: UploadStatus.REJECTED, reason: 'the video codec hvc1 is not supported: re-encode it as H.264' } } });
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 5 * MIB), { store: memoryStore() });
    expect(res).toEqual({ status: 'refused', reason: 'the video codec hvc1 is not supported: re-encode it as H.264' });
  });

  it('a video that is already there is a duplicate with the existing video', async () => {
    const existing = listed('v1', 'Beach');
    const s = fakeVideoServer({ script: { complete: { status: UploadStatus.DUPLICATE, video: existing } } });
    const res = await uploadVideo(s.uploadClient, bigFile('a.mp4', 5 * MIB), { store: memoryStore() });
    expect(res.status).toBe('duplicate');
    expect(res.status === 'duplicate' && res.video.id).toBe('v1');
  });

  it('the whole file is never read at once: only slices of it', async () => {
    const s = fakeVideoServer();
    const file = bigFile('a.mp4', 9 * MIB); // arrayBuffer(), text() and stream() of the file itself throw
    const res = await uploadVideo(s.uploadClient, file, { store: memoryStore() });
    expect(res.status).toBe('added');
  });

  it('the same name and size with another modification time is another file: the old upload is thrown away first', async () => {
    const s = fakeVideoServer();
    const store = memoryStore({ 'a.mp4|5242880': { uploadId: 'old-upload', lastModified: 111 } });
    await uploadVideo(s.uploadClient, bigFile('a.mp4', 5 * MIB, 222), { store });
    expect(s.calls.abort).toEqual(['old-upload']);
    expect(s.calls.begin).toHaveLength(1);
  });

  it('the same file (same modification time) resumes and is not thrown away', async () => {
    const s = fakeVideoServer({ script: { received: 4 * MIB } });
    const store = memoryStore({ 'a.mp4|5242880': { uploadId: 'up1', lastModified: 222 } });
    await uploadVideo(s.uploadClient, bigFile('a.mp4', 5 * MIB, 222), { store });
    expect(s.calls.abort).toEqual([]);
    expect(s.calls.chunks[0].offset).toBe(4 * MIB);
  });

  it('what it keeps for a resume is there while the upload runs and gone when it ends', async () => {
    const s = fakeVideoServer({ script: { hangAt: [2] } });
    const store = memoryStore();
    const ac = new AbortController();
    const pending = uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB, 7), { store, signal: ac.signal });
    await vi.waitFor(() => expect(s.calls.chunks).toHaveLength(2));
    expect(store.data).toEqual({ 'a.mp4|10485760': { uploadId: 'up1', lastModified: 7 } });
    ac.abort();
    await pending;
    const done = fakeVideoServer();
    const store2 = memoryStore();
    await uploadVideo(done.uploadClient, bigFile('b.mp4', 5 * MIB), { store: store2 });
    expect(store2.data).toEqual({});
  });

  it('reports the progress at most every 250 ms, and always the start and the end', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const s = fakeVideoServer();
    const quick: number[] = [];
    await uploadVideo(s.uploadClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), onProgress: (got) => quick.push(got) });
    expect(quick, 'all in one instant: only the first and the last').toEqual([0, 10 * MIB]);
    // 300 ms pass during every chunk: every chunk is reported
    const s2 = fakeVideoServer();
    const slowClient = { ...s2.uploadClient, uploadVideoChunk: (...a: Parameters<typeof s2.uploadClient.uploadVideoChunk>) => (vi.advanceTimersByTime(300), s2.uploadClient.uploadVideoChunk(...a)) } as typeof s2.uploadClient;
    const slow: number[] = [];
    await uploadVideo(slowClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), onProgress: (got) => slow.push(got) });
    expect(slow).toEqual([0, 4 * MIB, 8 * MIB, 10 * MIB, 10 * MIB]);
    // 100 ms pass during every chunk: the 250 ms limit keeps some of them back
    const s3 = fakeVideoServer();
    const fastClient = { ...s3.uploadClient, uploadVideoChunk: (...a: Parameters<typeof s3.uploadClient.uploadVideoChunk>) => (vi.advanceTimersByTime(100), s3.uploadClient.uploadVideoChunk(...a)) } as typeof s3.uploadClient;
    const fast: number[] = [];
    await uploadVideo(fastClient, bigFile('a.mp4', 10 * MIB), { store: memoryStore(), onProgress: (got) => fast.push(got) });
    expect(fast, 'only the start, the third chunk and the end').toEqual([0, 10 * MIB, 10 * MIB]);
  });
});
