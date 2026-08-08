import { createPinia, setActivePinia } from 'pinia';
import { useJwStore } from 'src/stores/jw';
import { registerCachePathProvider } from 'src/utils/fs';
import { join } from 'upath';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fs, getAppDataPath } = globalThis.electronApi;
const { emptyDir, ensureDir, pathExists, readFile, remove, writeFile } = fs;

vi.mock('src/helpers/error-catcher', () => ({
  errorCatcher: vi.fn(),
}));

vi.mock('src/utils/api', () => ({
  fetchRaw: vi.fn(),
}));

describe('getLocalFontPath', () => {
  let appDataPath = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    setActivePinia(createPinia());
    registerCachePathProvider(() => undefined);
    appDataPath = await getAppDataPath();
    await remove(appDataPath);
  });

  it('deletes a legacy JW-Icons cache instead of drawing icons with it', async () => {
    // JW-Icons was never renamed to jw-icons-all; it is a different, smaller
    // font. Reusing it drew the yeartext logo too large for its box and clipped
    // the W, and because the file was accepted as a cache hit the correct font
    // was never fetched.
    const fontsDir = join(appDataPath, 'Fonts');
    await ensureDir(fontsDir);
    const legacyFontPath = join(fontsDir, 'JW-Icons.woff2');
    await writeFile(legacyFontPath, Buffer.from('cached-font'));

    const store = useJwStore();
    store.urlVariables.base = 'example.org';
    store.fontUrls['jw-icons-all'] = 'https://example.org/jw-icons-all.woff';

    const { fetchRaw } = await import('src/utils/api');
    vi.mocked(fetchRaw).mockResolvedValue(
      new Response(Buffer.from('fresh-font')),
    );
    const { getLocalFontPath } = await import('../fonts');

    const resolved = await getLocalFontPath('jw-icons-all');

    expect(resolved).not.toBe(legacyFontPath);
    await expect(pathExists(legacyFontPath)).resolves.toBe(false);
    expect(fetchRaw).toHaveBeenCalled();
  });

  it('reuses a cached .woff file when no .woff2 cache entry exists', async () => {
    const fontsDir = join(appDataPath, 'Fonts');
    await ensureDir(fontsDir);
    const cachedFontPath = join(fontsDir, 'Wt-ClearText-Bold.woff');
    await writeFile(cachedFontPath, Buffer.from('cached-font'));

    const store = useJwStore();
    store.urlVariables.base = 'example.org';

    const { fetchRaw } = await import('src/utils/api');
    const { getLocalFontPath } = await import('../fonts');

    await expect(getLocalFontPath('Wt-ClearText-Bold')).resolves.toBe(
      cachedFontPath,
    );
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('falls back to the dynamically discovered jw-icons URL when the hard-coded URL 404s', async () => {
    const fontsDir = join(appDataPath, 'Fonts');
    await emptyDir(fontsDir);

    const store = useJwStore();
    store.urlVariables.base = 'example.org';
    store.updateJwIconsUrl = vi.fn(async () => {
      store.jwIconsUrl =
        'https://cdn.example.org/assets/fonts/jw-icons-all.woff';
    });

    const firstUrl = store.fontUrls['jw-icons-all'];
    const dynamicUrl = 'https://cdn.example.org/assets/fonts/jw-icons-all.woff';
    const downloadedFont = Uint8Array.from([1, 2, 3, 4]);

    const { fetchRaw } = await import('src/utils/api');
    vi.mocked(fetchRaw)
      .mockResolvedValueOnce(
        new Response('missing', { status: 404, statusText: 'Not Found' }),
      )
      .mockResolvedValueOnce(new Response(downloadedFont, { status: 200 }));

    const { getLocalFontPath } = await import('../fonts');
    const fontPath = await getLocalFontPath('jw-icons-all');

    expect(fontPath).toBe(join(fontsDir, 'jw-icons-all.woff'));
    expect(store.updateJwIconsUrl).toHaveBeenCalledTimes(1);
    expect(fetchRaw).toHaveBeenNthCalledWith(
      1,
      firstUrl,
      expect.objectContaining({ method: 'GET' }),
      false,
    );
    expect(fetchRaw).toHaveBeenNthCalledWith(
      2,
      dynamicUrl,
      expect.objectContaining({ method: 'GET' }),
      false,
    );
    expect(await pathExists(fontPath)).toBe(true);
    expect(await readFile(fontPath)).toEqual(Buffer.from(downloadedFont));
  });
});
