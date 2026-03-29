<template>
  <div class="no-scroll fit-snugly">
    <q-layout class="bg-black text-white" style="align-content: center">
      <!-- This is where pages get injected -->
      <router-view />
    </q-layout>
  </div>
</template>

<script setup lang="ts">
import { useBroadcastChannel } from '@vueuse/core';
import { useMeta } from 'quasar';
import { initializeElectronApi } from 'src/helpers/electron-api-manager';
import { onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n({ useScope: 'global' });

initializeElectronApi('TimerLayout');

useMeta({
  title: 'Timer',
  titleTemplate: (title) => `${title} - M³`,
});

// Receive locale from main window via BroadcastChannel
const { data: timerLocale } = useBroadcastChannel<string, string>({
  name: 'timer-locale',
});

// Request locale from main window on mount
const { post: requestLocale } = useBroadcastChannel<string, string>({
  name: 'timer-locale-request',
});

watch(timerLocale, (lang) => {
  if (lang) locale.value = lang;
});

onMounted(() => {
  document.body.style.overflow = 'hidden';
  // Ask main window to send current locale
  requestLocale('request');
});
</script>
