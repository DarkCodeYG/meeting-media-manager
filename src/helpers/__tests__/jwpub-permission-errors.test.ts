import { beforeEach, describe, expect, it, vi } from 'vitest';

const getZipEntries = vi.fn();
const unzip = vi.fn();
const remove = vi.fn();
const stat = vi.fn();

vi.mock('src/helpers/error-catcher', () => ({ errorCatcher: vi.fn() }));
vi.mock('src/utils/fs', () => ({
  getTempPath: vi.fn(async () => '/tmp'),
}));
vi.mock('src/utils/sqlite', () => ({
  findDb: vi.fn(async () => '/out/pub.db'),
  getPublicationInfoFromDb: vi.fn(),
}));
// extractedFiles matters: unzipJwpub indexes into it before reaching the
// extractor, so leaving it out makes every assertion below vacuous.
vi.mock('stores/current-state', () => ({
  useCurrentStateStore: () => ({ currentSettings: {}, extractedFiles: {} }),
}));

const err = (code: string) => Object.assign(new Error(code), { code });

/**
 * These exercise the deletion branches of the .jwpub extractor. Permission errors
 * used to be treated as corruption, so a publication in a folder that was
 * momentarily unreadable — a network share, a locked folder, a reconnecting drive
 * — was deleted, and the redownload hit the same error.
 */
describe('jwpub extraction and permission errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    globalThis.electronApi = {
      ...(globalThis.electronApi ?? {}),
      fs: { exists: vi.fn(async () => true), remove, stat },
      getZipEntries,
      join: (...p: string[]) => p.join('/'),
      unzip,
    } as unknown as typeof globalThis.electronApi;
  });

  const loadExtractor = async () =>
    (await import('src/helpers/mediaPlayback')).unzipJwpub;

  it.each(['EACCES', 'EPERM'])(
    'keeps the publication when reading entries fails with %s',
    async (code) => {
      getZipEntries.mockRejectedValue(err(code));
      const unzipJwpub = await loadExtractor();

      await unzipJwpub('/pubs/a.jwpub', '/out').catch(() => undefined);

      expect(remove).not.toHaveBeenCalledWith('/pubs/a.jwpub');
    },
  );

  it('still deletes the publication when it is genuinely unreadable', async () => {
    // Not a permission code: this is what corruption looks like, and deleting
    // forces a redownload that can actually succeed.
    getZipEntries.mockRejectedValue(err('EBADF'));
    const unzipJwpub = await loadExtractor();

    await unzipJwpub('/pubs/b.jwpub', '/out').catch(() => undefined);

    expect(remove).toHaveBeenCalledWith('/pubs/b.jwpub');
  });

  it.each(['EACCES', 'EPERM'])(
    'keeps the publication when unzipping fails with %s',
    async (code) => {
      getZipEntries.mockResolvedValue({ contents: 100 });
      stat.mockResolvedValue(undefined);
      unzip.mockRejectedValue(err(code));
      const unzipJwpub = await loadExtractor();

      await unzipJwpub('/pubs/c.jwpub', '/out').catch(() => undefined);

      expect(remove).not.toHaveBeenCalledWith('/pubs/c.jwpub');
    },
  );
});
