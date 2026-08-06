import type {
  CongregationSearchResult,
  MeetingLanguage,
  MeetingSearchResponse,
  NormalizedSchedule,
  ScheduleDetails,
  SettingsValues,
} from 'src/types';

import { i18n } from 'boot/i18n';
import { storeToRefs } from 'pinia';
import { createTemporaryNotification } from 'src/helpers/notifications';
import { log } from 'src/shared/vanilla';
import { fetchJson } from 'src/utils/api';
import { isInPast } from 'src/utils/date';
import { useCurrentStateStore } from 'stores/current-state';

import { errorCatcher } from './error-catcher';

let meetingLanguagesPromise: null | Promise<Map<string, string>> = null;

/**
 * Spoken meeting languages that need mapping to the written language this fork
 * actually supports.
 *
 * The meetings API tags a congregation with the language it *meets* in, which for
 * Chinese congregations is `CHM` ("Chinese (Mandarin)"), a spoken entry. The
 * app's language list holds written/publication languages, so `CHM` never
 * matches and the lookup used to fall back to English — which silently wiped a
 * working Chinese setup, taking the pinyin toggle and the yeartext with it.
 *
 * Kept deliberately narrow: only the languages this fork ships support for.
 * Verified against hub.jw.org/meetings/api/languages, which lists CHM and CHS as
 * separate entries.
 */
const SPOKEN_TO_WRITTEN_LANG: Record<string, string> = {
  CHM: 'CHS', // Chinese (Mandarin), spoken -> Chinese Mandarin (Simplified)
};

/**
 * Maps a meeting `languageGuid` to a JW language code.
 *
 * The meeting search API identifies languages by GUID rather than by code, so
 * this table is needed to turn a lookup result into something the app's language
 * settings understand. Fetched once per session.
 */
export const getMeetingLanguageMap = async () => {
  if (!meetingLanguagesPromise) {
    meetingLanguagesPromise = (async () => {
      const languages =
        (await fetchJson<MeetingLanguage[]>(
          'https://hub.jw.org/meetings/api/languages',
          undefined,
          useCurrentStateStore().online,
        )) || [];
      return new Map(
        languages.map((language) => [
          language.languageGuid,
          SPOKEN_TO_WRITTEN_LANG[language.code] ?? language.code,
        ]),
      );
    })();
  }
  return meetingLanguagesPromise;
};

export const normalizeSchedule = (
  schedule: ScheduleDetails,
): NormalizedSchedule => {
  const normalized: NormalizedSchedule = {
    current: null,
    future: null,
  };

  if (schedule.current) {
    normalized.current = {
      mwDay: `${schedule.current.midweek.weekday - 1}`,
      mwStartTime: schedule.current.midweek.time,
      weDay: `${schedule.current.weekend.weekday - 1}`,
      weStartTime: schedule.current.weekend.time,
    };
  }

  if (schedule.future && schedule.futureDate) {
    if (isInPast(schedule.futureDate, true)) {
      normalized.current = {
        mwDay: `${schedule.future.midweek.weekday - 1}`,
        mwStartTime: schedule.future.midweek.time,
        weDay: `${schedule.future.weekend.weekday - 1}`,
        weStartTime: schedule.future.weekend.time,
      };
    } else {
      normalized.future = {
        date: schedule.futureDate.replaceAll(
          '-',
          '/',
        ) as `${number}/${number}/${number}`,
        mwDay: `${schedule.future.midweek.weekday - 1}`,
        mwStartTime: schedule.future.midweek.time,
        weDay: `${schedule.future.weekend.weekday - 1}`,
        weStartTime: schedule.future.weekend.time,
      };
    }
  }

  return normalized;
};

export const applyScheduleToSettings = (
  currentSettings: SettingsValues,
  normalized: NormalizedSchedule,
): { currentChanged: boolean; futureChanged: boolean } => {
  let currentChanged = false;
  let futureChanged = false;

  if (normalized.current) {
    const { mwDay, mwStartTime, weDay, weStartTime } = normalized.current;
    if (
      currentSettings.mwDay !== mwDay ||
      currentSettings.mwStartTime !== mwStartTime ||
      currentSettings.weDay !== weDay ||
      currentSettings.weStartTime !== weStartTime
    ) {
      currentSettings.mwDay = mwDay;
      currentSettings.mwStartTime = mwStartTime;
      currentSettings.weDay = weDay;
      currentSettings.weStartTime = weStartTime;
      currentChanged = true;
    }
  }

  if (normalized.future) {
    const {
      date,
      mwDay: fMwDay,
      mwStartTime: fMwStartTime,
      weDay: fWeDay,
      weStartTime: fWeStartTime,
    } = normalized.future;

    if (
      currentSettings.meetingScheduleChangeDate !== date ||
      currentSettings.meetingScheduleChangeMwDay !== fMwDay ||
      currentSettings.meetingScheduleChangeMwStartTime !== fMwStartTime ||
      currentSettings.meetingScheduleChangeWeDay !== fWeDay ||
      currentSettings.meetingScheduleChangeWeStartTime !== fWeStartTime
    ) {
      currentSettings.meetingScheduleChangeDate = date;
      currentSettings.meetingScheduleChangeMwDay = fMwDay;
      currentSettings.meetingScheduleChangeMwStartTime = fMwStartTime;
      currentSettings.meetingScheduleChangeWeDay = fWeDay;
      currentSettings.meetingScheduleChangeWeStartTime = fWeStartTime;
      currentSettings.meetingScheduleChangeOnce = false;
      futureChanged = true;
    }
  }

  return { currentChanged, futureChanged };
};

export const syncMeetingSchedule = async (force = false) => {
  try {
    const currentState = useCurrentStateStore();
    const { currentSettings, online } = storeToRefs(currentState);

    if (!currentSettings.value || !online.value) return false;

    // Only sync if enabled or forced
    if (!force && !currentSettings.value.enableAutomaticMeetingScheduleUpdates)
      return false;

    // Only sync if name hasn't been modified
    if (
      currentSettings.value.congregationNameModified ||
      !currentSettings.value.congregationName
    )
      return false;

    // Skip if a future change is already scheduled
    if (currentSettings.value.meetingScheduleChangeDate) {
      log(
        '🔄 [syncMeetingSchedule] Skipping lookup as a future change is already scheduled.',
        'congregationSchedule',
        'log',
      );
      return false;
    }

    // Two steps now: search by name for a guid, then fetch that guid's details.
    const suggestions = await fetchCongregationSuggestions(
      currentSettings.value.congregationName,
    );
    const exactMatch = suggestions.find(
      (result) =>
        result.name.toLowerCase() ===
        currentSettings.value?.congregationName?.toLowerCase(),
    );
    if (!exactMatch) return false;

    const response = await fetchMeetingLocations(exactMatch.congregationGuid);

    const congregationOnlineInfo = response?.items?.find((item) =>
      item.congregationMeetings.some(
        (meeting) => meeting.name === currentSettings.value?.congregationName,
      ),
    );

    if (congregationOnlineInfo) {
      const selectedMeeting = congregationOnlineInfo.congregationMeetings.find(
        (meeting) => meeting.name === currentSettings.value?.congregationName,
      );
      if (!selectedMeeting) return false;

      // The new API reports days as 0-6 (Sunday-Saturday) and times as HH:MM:SS,
      // while normalizeSchedule expects 1-7 and HH:MM.
      const normalized = normalizeSchedule({
        changeStamp: null,
        current: {
          midweek: {
            time: selectedMeeting.midweekMeetingTime.slice(
              0,
              5,
            ) as `${number}:${number}`,
            weekday: selectedMeeting.midweekMeetingDay + 1,
          },
          weekend: {
            time: selectedMeeting.weekendMeetingTime.slice(
              0,
              5,
            ) as `${number}:${number}`,
            weekday: selectedMeeting.weekendMeetingDay + 1,
          },
        },
        future: null,
        futureDate: null,
      });

      const { currentChanged, futureChanged } = applyScheduleToSettings(
        currentSettings.value,
        normalized,
      );

      if (currentChanged) {
        createTemporaryNotification({
          icon: 'mmm-info',
          message: (i18n.global.t as (key: string) => string)(
            'meeting-current-schedule-updated',
          ),
          timeout: 10000,
          type: 'info',
        });
      }

      if (futureChanged) {
        createTemporaryNotification({
          icon: 'mmm-info',
          message: (i18n.global.t as (key: string) => string)(
            'meeting-future-schedule-updated',
          ),
          timeout: 10000,
          type: 'info',
        });
      }

      return currentChanged || futureChanged;
    }
  } catch (error) {
    errorCatcher(error, {
      contexts: { fn: { name: 'syncMeetingSchedule' } },
    });
    return false;
  }
};

/**
 * Searches congregations by name.
 *
 * First half of the lookup: returns candidates with the guid needed by
 * `fetchMeetingLocations`.
 */
export const fetchCongregationSuggestions = async (keywords: string) =>
  (await fetchJson<CongregationSearchResult[]>(
    'https://hub.jw.org/meetings/api/congregations',
    new URLSearchParams({
      congregationName: keywords,
    }),
    useCurrentStateStore().online,
  )) || [];

/**
 * Fetches meeting details for a congregation guid.
 *
 * Second half of the lookup. Replaces the old single-call
 * `apps.{base}/api/public/meeting-search/weekly-meetings` endpoint, which JW
 * retired in early May 2026 and which now answers 404 — the reason congregation
 * lookup stopped returning meeting times.
 *
 * Note this endpoint is on `hub.jw.org` and does not follow the configured base
 * URL, unlike the old one.
 */
export const fetchMeetingLocations = async (
  meetingLocationEventGuid: string,
): Promise<MeetingSearchResponse | null> => {
  if (!meetingLocationEventGuid)
    return { hasResultsOutsideViewport: false, items: [] };

  const details = await fetchJson<MeetingSearchResponse>(
    'https://hub.jw.org/meetings/api/meeting-search',
    new URLSearchParams({
      first: '20',
      meetingLocationEventGuid,
    }),
    useCurrentStateStore().online,
  );

  return {
    hasResultsOutsideViewport: details?.hasResultsOutsideViewport || false,
    items: details?.items || [],
  };
};
