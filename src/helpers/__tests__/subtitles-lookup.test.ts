import type { MultimediaItem } from 'src/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings: Record<string, unknown> = {
  enableSubtitles: true,
  lang: 'CHS',
  langSubtitles: 'CHS',
};

vi.mock('stores/current-state', () => ({
  useCurrentStateStore: () => ({ currentSettings: settings }),
}));

vi.mock('stores/jw', () => ({
  useJwStore: () => ({}),
}));

vi.mock('src/helpers/error-catcher', () => ({
  errorCatcher: vi.fn(),
}));

const getJwMediaInfo = vi.fn();
const downloadFileIfNeeded = vi.fn();

const loadHelper = async () => {
  const mod = await import('src/helpers/fs');
  mod.registerMediaProviders({
    downloadFileIfNeeded,
    getJwMediaInfo,
  } as unknown as Parameters<typeof mod.registerMediaProviders>[0]);
  return mod.getSubtitlesUrl;
};

/**
 * The real shape of a video row in a media-playlist .jwpub (S-418mp): the video
 * carries MimeType/KeySymbol/Track but its FilePath is the linked preview
 * image, because getDocumentMultimediaItems copies the linked item's path onto
 * the video row and then drops the image row.
 */
const jwpubVideo = (overrides: Partial<MultimediaItem> = {}) =>
  ({
    FilePath: 'C:/pubs/S-418mp-26_CHS/S-341-26v_univ_wsr_01.jpg',
    KeySymbol: 'S-341-26v',
    MimeType: 'video/mp4',
    MultimediaId: 2,
    Track: 1,
    ...overrides,
  }) as MultimediaItem;

describe('getSubtitlesUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    settings.enableSubtitles = true;
    // Returning no subtitles stops the function before it downloads anything;
    // these tests are about whether the lookup is attempted at all.
    getJwMediaInfo.mockResolvedValue({ duration: 177.261 });
  });

  it('looks subtitles up for a jwpub video whose FilePath is its preview image', async () => {
    const getSubtitlesUrl = await loadHelper();

    await getSubtitlesUrl(jwpubVideo(), 177.261);

    expect(getJwMediaInfo).toHaveBeenCalledWith({
      fileformat: 'MP4',
      issue: undefined,
      langwritten: 'CHS',
      pub: 'S-341-26v',
      track: 1,
    });
  });

  it('still looks up a video identified only by its file extension', async () => {
    const getSubtitlesUrl = await loadHelper();

    await getSubtitlesUrl(
      jwpubVideo({ FilePath: 'C:/pubs/x/video.mp4', MimeType: undefined }),
      177.261,
    );

    expect(getJwMediaInfo).toHaveBeenCalled();
  });

  it('does not throw when the item has no FilePath at all', async () => {
    const getSubtitlesUrl = await loadHelper();

    await expect(
      getSubtitlesUrl(jwpubVideo({ FilePath: undefined }), 177.261),
    ).resolves.toBe('');
    expect(getJwMediaInfo).toHaveBeenCalled();
  });

  it('skips images', async () => {
    const getSubtitlesUrl = await loadHelper();

    await getSubtitlesUrl(
      jwpubVideo({ MimeType: 'image/jpeg', Track: undefined }),
      0,
    );

    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });

  it('skips a video with no Track, which the media API needs', async () => {
    const getSubtitlesUrl = await loadHelper();

    await getSubtitlesUrl(jwpubVideo({ Track: undefined }), 177.261);

    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });

  it('skips everything when subtitles are turned off', async () => {
    settings.enableSubtitles = false;
    const getSubtitlesUrl = await loadHelper();

    await getSubtitlesUrl(jwpubVideo(), 177.261);

    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });

  it('gives up quietly when the lookup finds no subtitles', async () => {
    getJwMediaInfo.mockResolvedValue({ duration: 0, subtitles: '' });
    const getSubtitlesUrl = await loadHelper();

    await expect(getSubtitlesUrl(jwpubVideo(), 177.261)).resolves.toBe('');
    expect(downloadFileIfNeeded).not.toHaveBeenCalled();
  });
});
