<template>
  <q-item class="items-center">
    <q-item-section>
      <q-input
        v-model="talkTitle"
        autogrow
        clearable
        dense
        :label="
          t(
            sectionId === 'pt'
              ? 'public-talk-title'
              : sectionId === 'service-talk'
                ? 'service-talk-title'
                : 'talk-title',
          )
        "
        outlined
        style="max-width: calc(100% - 16px)"
        type="textarea"
      />
      <q-input
        v-model="speakerInfo"
        autogrow
        class="q-mt-sm"
        clearable
        dense
        :label="t('talk-speaker-placeholder')"
        outlined
        style="max-width: calc(100% - 16px)"
        type="textarea"
      />
    </q-item-section>
    <q-item-section side style="align-content: center">
      <q-btn
        v-if="!isPlaying"
        :color="talkTitle?.trim() ? 'primary' : 'grey'"
        :disable="!talkTitle?.trim() || videoOrAudioPlaying"
        icon="mmm-play"
        rounded
        @click="togglePlay"
      />
      <q-btn
        v-else
        color="negative"
        icon="mmm-stop"
        rounded
        @click="togglePlay"
      />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import type { MediaSectionWithConfig } from 'src/types';

import { storeToRefs } from 'pinia';
import { locales } from 'src/constants/locales';
import { toggleMediaWindowVisibility } from 'src/helpers/mediaPlayback';
import { triggerZoomScreenShare } from 'src/helpers/zoom';
import { isAudio, isVideo } from 'src/utils/media';
import { useCurrentStateStore } from 'stores/current-state';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  isPublicTalk?: boolean;
  mediaList: MediaSectionWithConfig;
}>();

const emit = defineEmits<{
  'update-speaker-info': [speaker: string];
  'update-talk-title': [title: string];
}>();

const { t } = useI18n();
const currentState = useCurrentStateStore();
const { currentSettings } = storeToRefs(currentState);

// Disable only when video/audio is playing (same as other media items)
const videoOrAudioPlaying = computed(
  () =>
    currentState.mediaPlaying.url !== '' &&
    (isVideo(currentState.mediaPlaying.url) ||
      isAudio(currentState.mediaPlaying.url)),
);

const talkTitle = ref(props.mediaList.config?.publicTalkTitle || '');
const speakerInfo = ref(props.mediaList.config?.publicTalkSpeaker || '');
const isPlaying = ref(false);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stopTitleDisplay = () => {
  if (!isPlaying.value) return;
  isPlaying.value = false;
  globalThis.dispatchEvent(
    new CustomEvent('public-talk-title', {
      detail: { html: null },
    }),
  );
};

const buildHtml = () => {
  const title = escapeHtml(talkTitle.value.trim()).replace(/\n/g, '<br>');
  const speaker = speakerInfo.value?.trim()
    ? `<p class="pt-speaker">${escapeHtml(speakerInfo.value.trim()).replace(/\n/g, '<br>')}</p>`
    : '';
  const lang = currentSettings.value?.lang;
  const locale = locales.find((l) => l.langcode === lang)?.value;
  if (props.isPublicTalk) {
    const subtitle = locale
      ? t('public-talk', {}, { locale })
      : t('public-talk');
    return `<p class="pt-subtitle"><strong>${subtitle}</strong></p><p class="pt-title"><strong>${title}</strong></p>${speaker}`;
  }
  if (sectionId === 'service-talk') {
    const subtitle = locale
      ? t('service-talk', {}, { locale })
      : t('service-talk');
    return `<p class="pt-subtitle"><strong>${subtitle}</strong></p><p class="pt-title"><strong>${title}</strong></p>${speaker}`;
  }
  return `<p class="pt-title"><strong>${title}</strong></p>${speaker}`;
};

const sectionId = props.mediaList.config?.uniqueId;

const togglePlay = () => {
  if (!talkTitle.value?.trim()) return;

  // Stop image playback before showing title
  if (!isPlaying.value && currentState.mediaPlaying.url !== '') {
    currentState.mediaPlaying = {
      action: '',
      currentPosition: 0,
      pan: { x: 0, y: 0 },
      seekTo: 0,
      subtitlesUrl: '',
      uniqueId: '',
      url: '',
      zoom: 1,
    };
  }

  isPlaying.value = !isPlaying.value;

  if (isPlaying.value) {
    // Stop other talk title cards before playing
    globalThis.dispatchEvent(
      new CustomEvent('stop-talk-title', { detail: { except: sectionId } }),
    );
    // Stop Zoom screen sharing for talk title display
    triggerZoomScreenShare(false);
    toggleMediaWindowVisibility(true);
  }

  globalThis.dispatchEvent(
    new CustomEvent('public-talk-title', {
      detail: { html: isPlaying.value ? buildHtml() : null },
    }),
  );
};

// Listen for stop signal from other talk title cards
const handleStopTalkTitle = (e: Event) => {
  const exceptId = (e as CustomEvent).detail?.except;
  if (exceptId !== sectionId && isPlaying.value) {
    isPlaying.value = false;
  }
};

onMounted(() => {
  globalThis.addEventListener('stop-talk-title', handleStopTalkTitle);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('stop-talk-title', handleStopTalkTitle);
});

// Persist talk title to section config via emit
watch(talkTitle, (val) => {
  stopTitleDisplay();
  emit('update-talk-title', val);
});

// Persist speaker info to section config via emit
watch(speakerInfo, (val) => {
  stopTitleDisplay();
  emit('update-speaker-info', val || '');
});

// Stop title display when any media starts playing (image, video, audio)
watch(
  () => currentState.mediaPlaying.url,
  (newUrl) => {
    if (newUrl) stopTitleDisplay();
  },
);

// Restore title when switching dates (mediaList prop changes)
watch(
  () => props.mediaList.config?.publicTalkTitle,
  (newVal) => {
    talkTitle.value = newVal || '';
  },
);

// Restore speaker info when switching dates
watch(
  () => props.mediaList.config?.publicTalkSpeaker,
  (newVal) => {
    speakerInfo.value = newVal || '';
  },
);
</script>
