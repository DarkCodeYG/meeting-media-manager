import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.fn();

vi.mock('src/utils/api', () => ({
  fetchJson: fetchJsonMock,
}));

vi.mock('src/helpers/error-catcher', () => ({
  errorCatcher: vi.fn(),
}));

vi.mock('src/helpers/notifications', () => ({
  createTemporaryNotification: vi.fn(),
}));

vi.mock('boot/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}));

describe('getMeetingLanguageMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setActivePinia(createPinia());
  });

  /** Fresh import per test: the map is memoized for the session. */
  const loadHelper = async () => {
    const mod = await import('src/helpers/congregation-schedule');
    return mod.getMeetingLanguageMap;
  };

  it('maps a language guid to its code', async () => {
    fetchJsonMock.mockResolvedValue([
      { code: 'KO', languageGuid: 'guid-ko', name: 'Korean' },
      { code: 'E', languageGuid: 'guid-en', name: 'English' },
    ]);

    const map = await (await loadHelper())();

    expect(map.get('guid-ko')).toBe('KO');
    expect(map.get('guid-en')).toBe('E');
  });

  it('maps spoken Mandarin (CHM) onto written Simplified Chinese (CHS)', async () => {
    // The meetings API tags a Chinese congregation with the language it meets in
    // — CHM, a spoken entry — while the app's language list holds written
    // languages. Without this mapping the lookup finds nothing for such a
    // congregation, which is how a working Chinese setup lost its pinyin toggle
    // (gated on lang === 'CHS') and its yeartext (stored per language).
    fetchJsonMock.mockResolvedValue([
      { code: 'CHM', languageGuid: 'guid-chm', name: 'Chinese (Mandarin)' },
    ]);

    const map = await (await loadHelper())();

    expect(map.get('guid-chm')).toBe('CHS');
  });

  it('leaves written Chinese untouched', async () => {
    fetchJsonMock.mockResolvedValue([
      {
        code: 'CHS',
        languageGuid: 'guid-chs',
        name: 'Chinese Mandarin (Simplified)',
      },
    ]);

    const map = await (await loadHelper())();

    expect(map.get('guid-chs')).toBe('CHS');
  });

  it('returns an empty map when the request yields nothing', async () => {
    fetchJsonMock.mockResolvedValue(null);

    const map = await (await loadHelper())();

    expect(map.size).toBe(0);
  });

  it('fetches the language table only once per session', async () => {
    fetchJsonMock.mockResolvedValue([
      { code: 'KO', languageGuid: 'guid-ko', name: 'Korean' },
    ]);

    const getMeetingLanguageMap = await loadHelper();
    await getMeetingLanguageMap();
    await getMeetingLanguageMap();

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });
});
