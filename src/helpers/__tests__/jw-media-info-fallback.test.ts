import type * as JwApi from 'src/utils/api';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMediaItems = vi.fn();
const fetchPubMediaLinks = vi.fn();

vi.mock('src/utils/api', async (importOriginal) => ({
  ...(await importOriginal<typeof JwApi>()),
  fetchMediaItems,
  fetchPubMediaLinks,
}));

vi.mock('src/helpers/error-catcher', () => ({ errorCatcher: vi.fn() }));

/**
 * The pub-media response for one of the videos listed in S-418mp-26_CHS_002,
 * trimmed to the fields the fallback reads. The mediator API answers
 * pub-S-341-26v_1_VIDEO with an empty media array, which is the case this
 * fallback exists for.
 */
const PUB_MEDIA_RESPONSE = {
  files: {
    CHS: {
      MP4: [
        {
          duration: 177.261,
          file: { url: 'https://example.invalid/S-341-26v_CHS_01_r720P.mp4' },
          label: '720p',
          subtitled: false,
          subtitles: {
            checksum: '05cac60fbae426f3de5fbfc900192c45',
            modifiedDatetime: '2025-11-03 06:36:44',
            url: 'https://example.invalid/S-341-26v_CHS_01.vtt',
          },
          title: '你愿意为好消息做什么？（1）',
          track: 1,
        },
      ],
    },
  },
};

const fetcher = {
  fileformat: 'MP4' as const,
  langwritten: 'CHS' as const,
  pub: 'S-341-26v',
  track: 1,
};

describe('getJwMediaInfo pub-media fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setActivePinia(createPinia());
  });

  const loadHelper = async () =>
    (await import('src/helpers/jw-media')).getJwMediaInfo;

  it('falls back to pub-media when the mediator has no media items', async () => {
    fetchMediaItems.mockResolvedValue({ media: [] });
    fetchPubMediaLinks.mockResolvedValue(PUB_MEDIA_RESPONSE);

    const info = await (await loadHelper())(fetcher);

    expect(info.subtitles).toBe('https://example.invalid/S-341-26v_CHS_01.vtt');
    expect(info.duration).toBe(177.261);
  });

  it('does not consult pub-media when the mediator answered', async () => {
    fetchMediaItems.mockResolvedValue({
      media: [
        {
          duration: 12,
          files: [
            {
              label: '720p',
              // isMediaLink() tells the two shapes apart by this field; without
              // it a mediator file is mistaken for a pub-media one.
              progressiveDownloadURL: 'https://example.invalid/v.mp4',
              subtitles: { url: 'from-mediator.vtt' },
            },
          ],
          images: {},
          title: 'From mediator',
        },
      ],
    });

    const info = await (await loadHelper())(fetcher);

    expect(info.subtitles).toBe('from-mediator.vtt');
    expect(fetchPubMediaLinks).not.toHaveBeenCalled();
  });

  it('returns the empty response when neither source has the media', async () => {
    fetchMediaItems.mockResolvedValue({ media: [] });
    fetchPubMediaLinks.mockResolvedValue({ files: {} });

    const info = await (await loadHelper())(fetcher);

    expect(info).toEqual({
      duration: 0,
      subtitles: '',
      thumbnail: '',
      title: '',
    });
  });

  it('tolerates a pub-media file that has no subtitle track', async () => {
    fetchMediaItems.mockResolvedValue({ media: [] });
    fetchPubMediaLinks.mockResolvedValue({
      files: {
        CHS: { MP4: [{ duration: 42, label: '720p', subtitled: false }] },
      },
    });

    const info = await (await loadHelper())(fetcher);

    expect(info.subtitles).toBe('');
    expect(info.duration).toBe(42);
  });
});
