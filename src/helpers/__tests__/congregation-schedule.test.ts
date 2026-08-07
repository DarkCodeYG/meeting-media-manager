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

  it('retries after a failed request instead of caching the empty result', async () => {
    // fetchJson answers null rather than throwing, so a request that failed
    // because the machine was briefly offline is indistinguishable from a real
    // empty table. Caching it would leave language resolution dead for the rest
    // of the session.
    fetchJsonMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { code: 'KO', languageGuid: 'guid-ko', name: 'Korean' },
      ]);

    const getMeetingLanguageMap = await loadHelper();
    expect((await getMeetingLanguageMap()).size).toBe(0);
    expect((await getMeetingLanguageMap()).get('guid-ko')).toBe('KO');
    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
  });
});

describe('buildScheduleFromMeeting', () => {
  const meeting = (overrides: Record<string, unknown> = {}) => ({
    midweekMeetingDay: 4, // Thursday
    midweekMeetingTime: '19:30:00',
    weekendMeetingDay: 0, // Sunday
    weekendMeetingTime: '10:00:00',
    ...overrides,
  });

  const build = async (input: unknown) => {
    const { buildScheduleFromMeeting } =
      await import('src/helpers/congregation-schedule');
    return buildScheduleFromMeeting(
      input as Parameters<typeof buildScheduleFromMeeting>[0],
    );
  };

  it('converts days and trims seconds off the times', async () => {
    expect((await build(meeting()))?.current).toEqual({
      mwDay: '3', // Thursday
      mwStartTime: '19:30',
      weDay: '6', // Sunday
      weStartTime: '10:00',
    });
  });

  it.each([
    ['no meeting at all', undefined],
    ['a missing midweek time', meeting({ midweekMeetingTime: undefined })],
    ['a missing weekend time', meeting({ weekendMeetingTime: undefined })],
    ['a missing midweek day', meeting({ midweekMeetingDay: undefined })],
    ['a missing weekend day', meeting({ weekendMeetingDay: undefined })],
  ])('returns null for %s', async (_name, input) => {
    // The types mark these required, but this is remote JSON: reading .slice off
    // a missing time threw, and the caller reported it as a silent no-op.
    expect(await build(input)).toBeNull();
  });

  it('accepts day 0, which is Sunday and not a missing value', async () => {
    // 0 is falsy, so a truthiness check in the guard would reject every
    // congregation whose weekend meeting is on a Sunday - almost all of them.
    expect(
      (await build(meeting({ weekendMeetingDay: 0 })))?.current?.weDay,
    ).toBe('6');
  });
});

describe('apiDayToScheduleWeekday', () => {
  /**
   * The API counts 0-6 from Sunday; mwDay/weDay count 0-6 from Monday. These
   * cases assert the round trip through normalizeSchedule, because that is what
   * actually reaches the settings — asserting the intermediate 1-7 value alone
   * would not have caught the off-by-one that shifted every meeting a day later
   * and stopped it from being recognised on its real date.
   */
  const settingsDay = async (apiDay: number) => {
    const { apiDayToScheduleWeekday, normalizeSchedule } =
      await import('src/helpers/congregation-schedule');
    return normalizeSchedule({
      changeStamp: null,
      current: {
        midweek: { time: '19:00', weekday: apiDayToScheduleWeekday(apiDay) },
        weekend: { time: '10:00', weekday: apiDayToScheduleWeekday(apiDay) },
      },
      future: null,
      futureDate: null,
    }).current?.weDay;
  };

  it.each([
    ['Sunday', 0, '6'],
    ['Monday', 1, '0'],
    ['Tuesday', 2, '1'],
    ['Wednesday', 3, '2'],
    ['Thursday', 4, '3'],
    ['Friday', 5, '4'],
    ['Saturday', 6, '5'],
  ])('stores API %s (%i) as weDay %s', async (_name, apiDay, expected) => {
    expect(await settingsDay(apiDay)).toBe(expected);
  });

  it('agrees with getWeekDay for every day of a real week', async () => {
    // The authority on the stored format: date.ts matches weDay against
    // getWeekDay(date). 2026-08-02 is a Sunday, so this walks Sun..Sat.
    const { apiDayToScheduleWeekday } =
      await import('src/helpers/congregation-schedule');

    for (let apiDay = 0; apiDay < 7; apiDay++) {
      const date = new Date(2026, 7, 2 + apiDay);
      expect(date.getDay()).toBe(apiDay); // the API's own numbering
      const getWeekDay = date.getDay() === 0 ? 6 : date.getDay() - 1;
      expect(apiDayToScheduleWeekday(apiDay) - 1).toBe(getWeekDay);
    }
  });
});
