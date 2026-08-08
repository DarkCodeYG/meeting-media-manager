import type { MediaItem } from 'src/types';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSidecarSubtitlesUrl = vi.fn();
const getJwPublishedSubtitlesUrl = vi.fn();
const getEmbeddedSubtitlesUrl = vi.fn();

vi.mock('src/helpers/fs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEmbeddedSubtitlesUrl,
  getJwPublishedSubtitlesUrl,
  getSidecarSubtitlesUrl,
}));

/** Files the app believes in; anything else is treated as swept from the cache. */
const presentFiles = new Set<string>();

vi.mock('src/helpers/error-catcher', () => ({ errorCatcher: vi.fn() }));

const video = (overrides: Partial<MediaItem> = {}) =>
  ({
    duration: 1155.4,
    fileUrl: 'file:///media/1112024059_KO_cnt_1_r720P.mp4',
    isVideo: true,
    uniqueId: 'item-1',
    ...overrides,
  }) as MediaItem;

describe('resolveSubtitlesIfMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setActivePinia(createPinia());

    presentFiles.clear();
    presentFiles.add('/media/1112024059_KO_cnt_1_r720P.mp4');

    const api = globalThis.electronApi as unknown as Record<string, unknown>;
    api.fileUrlToPath = (url: string) => url.replace('file://', '');
    (api.fs as Record<string, unknown>).pathExists = (p: string) =>
      Promise.resolve(presentFiles.has(p));

    getSidecarSubtitlesUrl.mockResolvedValue('');
    getJwPublishedSubtitlesUrl.mockResolvedValue('');
    getEmbeddedSubtitlesUrl.mockResolvedValue('');
  });

  const loadHelper = async () =>
    (await import('src/helpers/jw-media')).resolveSubtitlesIfMissing;

  const settle = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

  it('leaves an item alone while its subtitle file is still there', async () => {
    presentFiles.add('/cache/Temp/published.vtt');
    const item = video({ subtitlesUrl: 'file:///cache/Temp/published.vtt' });

    (await loadHelper())(item, 'cong-1');
    await settle();

    expect(item.subtitlesUrl).toBe('file:///cache/Temp/published.vtt');
    expect(getSidecarSubtitlesUrl).not.toHaveBeenCalled();
  });

  it('re-resolves an item whose subtitle file has been swept from the cache', async () => {
    // The URL survives in the store, the file does not. Left as-is, the player
    // attaches a <track> that fails to load and nothing ever tries again.
    getJwPublishedSubtitlesUrl.mockResolvedValue(
      'file:///cache/Temp/fresh.vtt',
    );
    const item = video({ subtitlesUrl: 'file:///cache/Temp/deleted.vtt' });

    (await loadHelper())(item, 'cong-1');
    await settle();

    expect(getJwPublishedSubtitlesUrl).toHaveBeenCalled();
  });

  it('clears the dead URL even when nothing can replace it', async () => {
    const item = video({ subtitlesUrl: 'file:///cache/Temp/deleted.vtt' });

    (await loadHelper())(item, 'cong-1');
    await settle();

    expect(item.subtitlesUrl).toBe('');
  });

  it('still resolves an item that never had subtitles', async () => {
    getSidecarSubtitlesUrl.mockResolvedValue('file:///media/beside.vtt');
    const item = video({ subtitlesUrl: '' });

    (await loadHelper())(item, 'cong-1');
    await settle();

    expect(item.subtitlesUrl).toBe('file:///media/beside.vtt');
  });

  it('does nothing for an item whose video file is gone', async () => {
    presentFiles.clear();
    const item = video({ subtitlesUrl: '' });

    (await loadHelper())(item, 'cong-1');
    await settle();

    expect(getSidecarSubtitlesUrl).not.toHaveBeenCalled();
  });
});
