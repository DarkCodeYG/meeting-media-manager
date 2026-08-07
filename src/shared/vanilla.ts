/**
 * Generates a UUID.
 * @returns The generated UUID.
 * @example
 * uuid() // '8e8679e3-02b1-410b-9399-2c1e5606a971'
 */
export const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(
    /[xy]/g,
    function (c) {
      const r = Math.trunc(Math.random() * 16),
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
};

/**
 * Throttles a function to run at regular intervals AND at the end
 * @param func The function to throttle
 * @param delay The delay in milliseconds
 * @returns The throttled function with trailing execution
 */
export const throttleWithTrailing = <T>(
  func: (...args: T[]) => void,
  delay: number,
) => {
  let lastExecTime = 0;
  let timeoutId: null | ReturnType<typeof setTimeout> = null;
  let lastArgs: null | T[] = null;

  return (...args: T[]) => {
    const now = Date.now();
    lastArgs = args;

    // Execute immediately if enough time has passed
    if (now - lastExecTime >= delay) {
      lastExecTime = now;
      func(...args);

      // Clear any pending trailing execution
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    } else {
      // Schedule trailing execution if not already scheduled
      timeoutId ??= setTimeout(
        () => {
          if (lastArgs) {
            lastExecTime = Date.now();
            func(...lastArgs);
            timeoutId = null;
            lastArgs = null;
          }
        },
        delay - (now - lastExecTime),
      );
    }
  };
};

/**
 * Debounces a function to run only after it stops being called for a delay period
 * @param func The function to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced function
 */
export const debounce = <T extends unknown[]>(
  func: (...args: T) => void,
  delay: number,
) => {
  let timeoutId: null | ReturnType<typeof setTimeout> = null;

  return (...args: T) => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Schedule new execution
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};

/**
 * Where JW places its own subtitles. Every cue in a JW-published `.vtt` carries
 * exactly these settings, e.g.
 *
 *     00:00:01.105 --> 00:00:02.231 line:90% position:50% align:center
 *
 * 90% of the way down rather than hard against the bottom, so the text clears
 * the edge of the screen.
 */
export const JW_CUE_SETTINGS = 'line:90% position:50% align:center';

/** A WebVTT cue timing line, with optional trailing settings. */
const CUE_TIMING =
  /^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})(.*)$/;

/**
 * Gives every cue that has no placement settings the same ones JW uses.
 *
 * Subtitles the app produces itself — extracted from a video container, or
 * converted from a SubRip sidecar — come out with bare timing lines, so the
 * player falls back to its default placement and they sit lower on screen than
 * the JW-published subtitles shown for the rest of a meeting's media. Same
 * video, different source, visibly different position.
 *
 * Cues that already specify placement are left alone: those settings came from
 * the subtitle author and are more likely to be deliberate, such as lifting a
 * line clear of on-screen text.
 *
 * Lives here rather than beside either caller because both need it and they sit
 * on opposite sides of the process boundary — SubRip conversion in the
 * renderer, FFmpeg extraction in the main process.
 *
 * @param vtt WebVTT content
 * @returns The same content with placement settings filled in where missing
 */
export const applyDefaultCuePlacement = (vtt: string) =>
  vtt
    .split('\n')
    .map((line) => {
      const match = CUE_TIMING.exec(line.trimEnd());
      if (!match) return line;
      const [, start, end, existingSettings] = match;
      if (existingSettings?.trim()) return line;
      return `${start} --> ${end} ${JW_CUE_SETTINGS}`;
    })
    .join('\n');

const logPrefixes = {
  api: '🌐 API',
  backgroundMusic: '🎵 Background Music',
  cacheAutoClear: '🧹 Cache Auto-Clear',
  cleanup: '🧽 Cleanup',
  congregation: '⛪ Congregation',
  congregationLookup: '🏛️ Congregation Lookup',
  congregationSchedule: '🗓️ Congregation Schedule',
  coWeek: '📅 Co-Week',
  customSections: '🧩 Custom Sections',
  dateHelpers: '📆 Date Helpers',
  dateUtils: '📆 Date Utils',
  dialog: '🪟 Dialog',
  display: '🖥️ Display',
  dividers: '🔤 Dividers',
  electron: '⚡ Electron',
  electronDependencies: '🧪 Electron Dependencies',
  electronDownloads: '⬇️ Electron Downloads',
  electronFilesystem: '📁 Electron Filesystem',
  electronIpc: '🔌 Electron IPC',
  electronScreen: '🖥️ Electron Screen',
  electronUpdater: '🆕 Electron Updater',
  electronWindow: '🪟 Electron Window',
  errorHandling: '🚨 Error Handling',
  fileImport: '📥 File Import',
  filesystem: '📁 Filesystem',
  jw: '📚 JW',
  jwPlaylist: '📋 JW Playlist',
  jwpub: '📦 JWPub',
  keyboardShortcuts: '⌨️ Keyboard Shortcuts',
  mainLayout: '🏠 Main Layout',
  mediaCalendar: '🗓️ Media Calendar',
  mediaFetching: '🔍 Media Fetching',
  mediaList: '🧾 Media List',
  mediaPlayback: '▶️ Media Playback',
  mediaPlayer: '🎬 Media Player',
  mediaPreview: '🎬 Media Preview',
  mediaProcessing: '🔄 Media Processing',
  mediaSectionRepeat: '🔁 Media Section Repeat',
  mediaSections: '🗂️ Media Sections',
  migrations: '🧱 Migrations',
  mwMedia: '🌅 Midweek Meeting Media',
  obs: '📡 OBS',
  publicationMedia: '📰 Publication Media',
  shortcutInput: '🎹 Shortcut Input',
  sqlite: '🗄️ SQLite',
  stores: '🧠 Stores',
  timer: '⏱️ Timer',
  watchedFolder: '📁 Watched Folder',
  weMedia: '🌅 Weekend Meeting Media',
  zoom: '🔎 Zoom',
} as const;

export type LogPrefix = keyof typeof logPrefixes;
export type LogType = 'debug' | 'error' | 'info' | 'log' | 'trace' | 'warn';

type ConsoleMethod = (...args: unknown[]) => void;

const getConsoleMethod = (type: LogType): ConsoleMethod => {
  const consoleObject = Reflect.get(globalThis, 'console') as
    | Partial<Record<LogType, ConsoleMethod>>
    | undefined;

  return consoleObject?.[type] ?? consoleObject?.log ?? (() => undefined);
};

export const log = (
  message: unknown,
  prefix?: LogPrefix,
  type: LogType = 'log',
  ...details: unknown[]
) => {
  try {
    const prefixLabel = prefix ? `[${logPrefixes[prefix]}]` : '';
    const logger = getConsoleMethod(type);

    if (typeof message === 'string') {
      const logMessage = prefixLabel ? `${prefixLabel} ${message}` : message;
      logger(logMessage, ...details);
      return;
    }

    logger(prefixLabel || '[log]', message, ...details);
  } catch (error) {
    const fallbackLogger = getConsoleMethod('error');
    fallbackLogger(error, { details, message, prefix, type });
  }
};
