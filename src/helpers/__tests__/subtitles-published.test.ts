import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings: Record<string, unknown> = {
  enableSubtitles: true,
  lang: 'KO',
  langSubtitles: 'KO',
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

vi.mock('src/utils/fs', () => ({
  getCachedUserDataPath: vi.fn(),
  getPublicationDirectory: vi.fn(),
  getTempPath: () => Promise.resolve('/cache/Temp'),
}));

const getJwMediaInfo = vi.fn();
const downloadFileIfNeeded = vi.fn();

const loadHelper = async () => {
  const mod = await import('src/helpers/fs');
  mod.registerMediaProviders({
    downloadFileIfNeeded,
    getJwMediaInfo,
  } as unknown as Parameters<typeof mod.registerMediaProviders>[0]);
  return mod.getJwPublishedSubtitlesUrl;
};

/** The video this was written for: JW places its 5–10s cues at `line:10%`. */
const DOCID_VIDEO = '/Users/x/Downloads/1112024059_KO_cnt_1_r720P.mp4';

describe('getJwPublishedSubtitlesUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    settings.enableSubtitles = true;
    getJwMediaInfo.mockResolvedValue({
      duration: 1155.4,
      subtitles: 'https://cfp2.jw-cdn.org/a/e9fd35/1/o/1112024059_KO_cnt_1.vtt',
    });
  });

  it('reads a document id, language and track out of a JW file name', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl(DOCID_VIDEO, 1155.4);

    expect(getJwMediaInfo).toHaveBeenCalledWith({
      docid: 1112024059,
      fileformat: 'MP4',
      langwritten: 'KO',
      track: 1,
    });
  });

  it('reads a publication symbol and track out of the other naming scheme', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl('/x/lffv_KO_191_r480P.mp4', 1155.4);

    expect(getJwMediaInfo).toHaveBeenCalledWith({
      fileformat: 'MP4',
      langwritten: 'KO',
      pub: 'lffv',
      track: 191,
    });
  });

  it('keeps a symbol that contains hyphens and digits intact', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl('/x/S-337-26v_KO_04_r720P.mp4', 1155.4);

    expect(getJwMediaInfo).toHaveBeenCalledWith(
      expect.objectContaining({ pub: 'S-337-26v', track: 4 }),
    );
  });

  it('asks for the subtitles in the language the file itself is in', async () => {
    settings.langSubtitles = 'E';
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl(
      '/x/1112024059_CHS_cnt_1_r720P.mp4',
      1155.4,
    );

    expect(getJwMediaInfo).toHaveBeenCalledWith(
      expect.objectContaining({ langwritten: 'CHS' }),
    );
    settings.langSubtitles = 'KO';
  });

  it('downloads the published file to the cache and returns its URL', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl(DOCID_VIDEO, 1155.4);

    expect(downloadFileIfNeeded).toHaveBeenCalledWith({
      dir: '/cache/Temp',
      filename: '1112024059_KO_cnt_1.vtt',
      lowPriority: true,
      url: 'https://cfp2.jw-cdn.org/a/e9fd35/1/o/1112024059_KO_cnt_1.vtt',
    });
  });

  it('ignores a name that is not one of JW’s', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await expect(
      getJwPublishedSubtitlesUrl('/x/holiday video.mp4', 60),
    ).resolves.toBe('');
    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });

  it('ignores a name whose language segment is not a real code', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl('/x/clip_ZZZZ_12_r720P.mp4', 60);

    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });

  it('rejects the match when the durations disagree', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    // A name is only a guess at which video this is, so a wrong duration means
    // the wrong video rather than a note in the log.
    await expect(getJwPublishedSubtitlesUrl(DOCID_VIDEO, 42)).resolves.toBe('');
    expect(downloadFileIfNeeded).not.toHaveBeenCalled();
  });

  it('accepts a match when the video duration is unknown', async () => {
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl(DOCID_VIDEO);

    expect(downloadFileIfNeeded).toHaveBeenCalled();
  });

  it('gives up quietly when JW publishes no subtitles for the video', async () => {
    getJwMediaInfo.mockResolvedValue({ duration: 1155.4, subtitles: '' });
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await expect(getJwPublishedSubtitlesUrl(DOCID_VIDEO, 1155.4)).resolves.toBe(
      '',
    );
    expect(downloadFileIfNeeded).not.toHaveBeenCalled();
  });

  it('skips everything when subtitles are turned off', async () => {
    settings.enableSubtitles = false;
    const getJwPublishedSubtitlesUrl = await loadHelper();

    await getJwPublishedSubtitlesUrl(DOCID_VIDEO, 1155.4);

    expect(getJwMediaInfo).not.toHaveBeenCalled();
  });
});
