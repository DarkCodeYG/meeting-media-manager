import { defineStore } from '@quasar/app-vite/wrappers';
import { createSentryPiniaPlugin } from '@sentry/vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default defineStore(() => {
  const pinia = createPinia();

  pinia.use(piniaPluginPersistedstate);

  pinia.use(
    createSentryPiniaPlugin({
      attachPiniaState: false, // Until https://github.com/getsentry/sentry-javascript/issues/14441 is fixed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stateTransformer: (state: Record<string, any>) => {
        try {
          // Transform the state to remove unneeded information that only takes up space
          const transformedState = {
            ...state,
            jwBibleFiles:
              'FILTERED (length: ' +
              Object.keys(state.jwBibleFiles || {}).length +
              ')',
            jwLanguages:
              'FILTERED (length: ' +
              (state.jwLanguages?.list?.length || 0) +
              ')',
            jwMepsLanguages:
              'FILTERED (length: ' +
              (state.jwMepsLanguages?.list?.length || 0) +
              ')',
            jwSongs:
              'FILTERED (length: ' +
              (Object.keys(state.jwSongs || {}).length || 0) +
              ')',
            yeartexts:
              'FILTERED (length: ' +
              (Object.keys(state.yeartexts || {}).length || 0) +
              ')',
          };
          return transformedState;
        } catch (error) {
          console.error(error);
          return state;
        }
      },
    }),
  );

  return pinia;
});
