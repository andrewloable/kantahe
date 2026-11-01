import { NavigationError } from '@angular/router';
import { handleStaleChunk, isChunkLoadError } from './stale-chunk';

const failedImport = () => new TypeError('Failed to fetch dynamically imported module: http://localhost/chunk-ABC12345.js');
const navigation = (url: string, error: unknown) => new NavigationError(1, url, error);

describe('isChunkLoadError', () => {
  it('knows the message of a failed dynamic import in Chrome, Firefox and Safari', () => {
    expect(isChunkLoadError(failedImport())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/chunk-1.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('is not fooled by other errors', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('Cannot match any routes')).toBe(false);
  });
});

describe('handleStaleChunk', () => {
  beforeEach(() => localStorage.clear());

  it('regression: a page left open across a server update reloads the page it was going to, so the click is not lost', () => {
    const reload = vi.fn();
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 1000);
    expect(reload).toHaveBeenCalledExactlyOnceWith('/admin/songs');
  });

  it('does not reload for an error that is not a failed chunk', () => {
    const reload = vi.fn();
    handleStaleChunk(navigation('/admin/songs', new Error('boom')), reload, 1000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads only once for the same page: a server that is down must not make a reload loop', () => {
    const reload = vi.fn();
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 1000);
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 4000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for another page, and for the same page after a while (a second update in the same tab)', () => {
    const reload = vi.fn();
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 1000);
    handleStaleChunk(navigation('/admin/users', failedImport()), reload, 2000);
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 60_000);
    expect(reload.mock.calls.map((c) => c[0])).toEqual(['/admin/songs', '/admin/users', '/admin/songs']);
  });

  it('does not reload when the browser will not remember it did (it could not stop a loop)', () => {
    const reload = vi.fn();
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    handleStaleChunk(navigation('/admin/songs', failedImport()), reload, 1000);
    blocked.mockRestore();
    expect(reload).not.toHaveBeenCalled();
  });
});
