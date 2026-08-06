<template>
  <BaseDialog v-model="dialogValue" :dialog-id="dialogId" persistent>
    <div class="bg-secondary-contrast flex q-px-none" style="flex-flow: column">
      <div class="text-h6 row q-px-md q-pt-lg">
        {{ t('congregation-lookup') }}
      </div>
      <div class="row q-px-md q-pt-md">
        {{ t('congregation-lookup-explain') }}
      </div>
      <div class="row q-px-md q-py-md">
        <q-input
          ref="congregationFilterInput"
          v-model="congregationFilter"
          clearable
          dense
          outlined
          spellcheck="false"
          @update:model-value="lookupCongregation"
        >
          <template #prepend>
            <q-icon name="mmm-search" />
          </template>
        </q-input>
      </div>
      <div class="q-pl-md overflow-auto row flex">
        <q-list
          class="q-pr-scroll full-width"
          padding
          separator
          style="max-height: 20vh"
        >
          <!-- Loading skeletons -->
          <template v-if="loading">
            <q-item
              v-for="skeletonIndex in 3"
              :key="skeletonIndex"
              class="items-center"
            >
              <q-item-section>
                <q-item-label>
                  <q-skeleton height="20px" type="text" width="50%" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton height="10px" type="text" width="50%" />
                </q-item-label>
              </q-item-section>
              <q-item-section side top>
                <q-item-label caption>
                  <q-skeleton height="10px" type="text" width="50px" />
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <q-item v-else-if="!results?.length">
            <q-item-section>
              <q-item-label>
                {{
                  congregationFilter?.length > 2
                    ? t('no-results')
                    : t('no-results-short')
                }}
              </q-item-label>
              <q-item-label caption>
                {{
                  congregationFilter?.length > 2
                    ? t('no-results-explain')
                    : t('no-results-short-explain')
                }}
              </q-item-label>
            </q-item-section>
          </q-item>
          <!--
            The name search only returns names and guids, so meeting times and
            language can no longer be previewed here; they are fetched when a
            result is picked. formattedName carries the congregation number,
            which is what distinguishes same-named congregations.
          -->
          <template
            v-for="congregation in results"
            :key="congregation.congregationGuid"
          >
            <q-item clickable @click="selectCongregation(congregation)">
              <q-item-section>
                <q-item-label>
                  {{ congregation.name }}
                </q-item-label>
                <q-item-label caption>
                  {{ congregation.formattedName }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </div>
      <div class="row q-px-md q-py-md row flex-center">
        <div class="col text-right">
          <q-btn color="negative" flat @click="dismissPopup">
            {{ t('cancel') }}
          </q-btn>
        </div>
      </div>
    </div>
  </BaseDialog>
</template>
<script setup lang="ts">
import type { CongregationSearchResult } from 'src/types';

import { whenever } from '@vueuse/core';
import BaseDialog from 'components/dialog/BaseDialog.vue';
import { storeToRefs } from 'pinia';
import {
  applyScheduleToSettings,
  fetchCongregationSuggestions,
  fetchMeetingLocations,
  getMeetingLanguageMap,
  normalizeSchedule,
} from 'src/helpers/congregation-schedule';
import { errorCatcher } from 'src/helpers/error-catcher';
import { log } from 'src/shared/vanilla';
import { useCurrentStateStore } from 'stores/current-state';
import { useJwStore } from 'stores/jw';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const jwStore = useJwStore();
const { jwLanguages } = storeToRefs(jwStore);

const currentState = useCurrentStateStore();
const { currentSettings } = storeToRefs(currentState);

const props = defineProps<{
  dialogId: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const dialogValue = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const congregationFilter = ref('');
const congregationFilterInput = ref();
const loading = ref(false);
const results = ref<CongregationSearchResult[]>([]);
const lookupDebounce = ref<null | ReturnType<typeof setTimeout>>(null);

const lookupCongregation = async () => {
  // Debounced: the search now fires per keystroke against a remote endpoint.
  if (lookupDebounce.value) clearTimeout(lookupDebounce.value);
  lookupDebounce.value = setTimeout(async () => {
    try {
      loading.value = true;
      results.value = [];
      if (congregationFilter.value?.length > 2) {
        results.value = await fetchCongregationSuggestions(
          congregationFilter.value,
        );
      } else {
        results.value = [];
      }
    } catch (error) {
      errorCatcher(error);
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 500);
};

const selectCongregation = async (congregation: CongregationSearchResult) => {
  try {
    if (!currentSettings.value) return;

    currentState.lookupInProgress = true;

    // Second half of the lookup: the name search gave us a guid, now fetch the
    // meeting details behind it.
    const response = await fetchMeetingLocations(congregation.congregationGuid);
    const selectedLocation = response?.items?.find((location) =>
      location.congregationMeetings.some(
        (meeting) => meeting.name === congregation.name,
      ),
    );
    if (!selectedLocation) return;
    const selectedMeeting = selectedLocation.congregationMeetings.find(
      (meeting) => meeting.name === congregation.name,
    );
    if (!selectedMeeting) return;

    // Language. The API identifies it by guid, so resolve through the language
    // table first.
    // NOTE: the old endpoint also returned writtenLanguageCode, which this fork
    // used to map a spoken language (e.g. Mandarin) onto its written variant
    // (cmn-hans). The replacement endpoint does not expose that, so a spoken-only
    // language now falls back to English instead. Needs a new data source.
    if (selectedMeeting.languageGuid) {
      const languageMap = await getMeetingLanguageMap();
      const mappedLanguageCode =
        languageMap.get(selectedMeeting.languageGuid) || '';
      const resolvedLangCode =
        jwLanguages.value?.list.find((l) => l.langcode === mappedLanguageCode)
          ?.langcode || '';
      currentSettings.value.lang = resolvedLangCode || 'E';
      currentSettings.value.langSubtitles = resolvedLangCode || null;
    }

    // Schedule. Days arrive 0-6 (Sunday first) and times as HH:MM:SS, but
    // normalizeSchedule expects 1-7 and HH:MM.
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
    applyScheduleToSettings(currentSettings.value, normalized);

    // Congregation name
    if (congregation.name) {
      currentSettings.value.congregationName = congregation.name;
      currentSettings.value.congregationNameModified = false;
    }
  } catch (error) {
    errorCatcher(error, {
      contexts: {
        fn: {
          name: 'DialogCongregationLookup.vue',
          subroutine: 'selectCongregation',
        },
      },
    });
  }
  currentState.lookupInProgress = false;
  dismissPopup();
};

const dismissPopup = () => {
  results.value = [];
  congregationFilter.value = '';
  dialogValue.value = false;
};

// Focus the input when dialog opens
whenever(dialogValue, () => {
  congregationFilter.value = currentSettings.value?.congregationName || '';
  results.value = [];
  lookupCongregation();
  setTimeout(() => {
    log(
      '🔍 Focusing input',
      'congregationLookup',
      'log',
      congregationFilterInput.value,
    );
    congregationFilterInput.value?.focus();
  }, 100);
});
</script>
