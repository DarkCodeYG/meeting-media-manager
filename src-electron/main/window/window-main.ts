import type * as WindowTimer from 'src-electron/main/window/window-timer';

import { BrowserWindow } from 'electron';
import { PLATFORM, PRODUCT_NAME } from 'src-electron/constants';
import { cancelAllDownloads } from 'src-electron/main/downloads';
import { setAppQuitting, setShouldQuit } from 'src-electron/main/session';
import {
  closeOtherWindows,
  createWindow,
  sendToWindow,
} from 'src-electron/main/window/window-base';
import {
  createMediaWindow,
  moveMediaWindowThrottled,
} from 'src-electron/main/window/window-media';

export const mainWindowInfo = {
  mainWindow: null as BrowserWindow | null,
};

let closeAttempts = 0;
let isCreatingMainWindow = false;

export const authorizedClose = {
  authorized: false,
};

// Loaded lazily, but only once: 'move' fires many times per second while the
// window is dragged, so re-entering import() on every event would allocate a
// promise and queue a microtask per frame of the drag.
let timerWindowModule: null | Promise<typeof WindowTimer> = null;

const syncTimerWindowPosition = () => {
  timerWindowModule ??= import('src-electron/main/window/window-timer');
  void timerWindowModule
    .then(({ moveTimerWindowThrottled, timerWindowInfo }) => {
      if (timerWindowInfo.timerWindow?.isVisible()) {
        moveTimerWindowThrottled();
      }
    })
    .catch(() => {
      // Ignore errors: timer window sync is best-effort and should never block main window moves.
      timerWindowModule = null; // allow a retry on the next move
    });
};

/**
 * Creates the main window
 */
export function createMainWindow() {
  // Reset app quitting state
  setAppQuitting(false);

  // If the window is already open, just focus it
  if (focusMainWindow() || isCreatingMainWindow) return;

  isCreatingMainWindow = true;

  try {
    // Create the browser window
    mainWindowInfo.mainWindow = createWindow('main');

    const handleMainWindowMove = () => {
      moveMediaWindowThrottled();
      syncTimerWindowPosition();
    };

    mainWindowInfo.mainWindow.on('move', handleMainWindowMove);
    if (PLATFORM !== 'darwin')
      mainWindowInfo.mainWindow.on('moved', handleMainWindowMove); // On macOS, the 'moved' event is just an alias for 'move'

    mainWindowInfo.mainWindow.on('close', (e) => {
      if (
        mainWindowInfo.mainWindow &&
        (authorizedClose.authorized || closeAttempts > 2)
      ) {
        cancelAllDownloads();
        closeOtherWindows(mainWindowInfo.mainWindow);
      } else {
        setShouldQuit(false);
        e.preventDefault();
        sendToWindow(mainWindowInfo.mainWindow, 'attemptedClose');
        closeAttempts++;
        setTimeout(() => {
          closeAttempts = 0;
        }, 10000);
      }
    });

    mainWindowInfo.mainWindow.on('closed', () => {
      mainWindowInfo.mainWindow = null;
    });

    createMediaWindow();
  } finally {
    isCreatingMainWindow = false;
  }
}

export function focusMainWindow() {
  const mainWindow = getExistingMainWindow();

  if (!mainWindow) return false;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  return true;
}

const getExistingMainWindow = () => {
  if (mainWindowInfo.mainWindow && !mainWindowInfo.mainWindow.isDestroyed()) {
    return mainWindowInfo.mainWindow;
  }

  const existingWindow = BrowserWindow.getAllWindows().find((window) => {
    return !window.isDestroyed() && window.getTitle() === PRODUCT_NAME;
  });

  if (existingWindow) {
    mainWindowInfo.mainWindow = existingWindow;
  }

  return existingWindow ?? null;
};

/**
 * Toggles the authorizedClose state
 * @param authorized Whether the window is authorized to close
 */
export function toggleAuthorizedClose(authorized: boolean) {
  authorizedClose.authorized = authorized;
}
