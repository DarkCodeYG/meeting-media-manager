import { errorCatcher } from 'src/helpers/error-catcher';
import { getFontsPath } from 'src/utils/fs';

import type { MigrationFunction } from './types';

const { fs, join } = globalThis.electronApi;
const { exists, remove } = fs;

/**
 * Remove legacy JW-Icons font cache files so the new jw-icons-all font is
 * downloaded fresh. Older fork builds cached the font as "JW-Icons.woff2"
 * (61 KB, fewer glyphs), which causes the "W" glyph to be clipped in the
 * yeartext logo box. The current name is "jw-icons-all.woff2" (148 KB).
 *
 * The legacy files are only deleted on this one-time migration run; subsequent
 * launches use the newly downloaded jw-icons-all.woff2 cache as normal.
 */
export const removeLegacyJwIconsFont: MigrationFunction = async () => {
  try {
    const fontsDir = await getFontsPath();
    const legacyNames = ['JW-Icons.woff2', 'JW-Icons.woff'];

    for (const name of legacyNames) {
      const filePath = join(fontsDir, name);
      if (await exists(filePath)) {
        await remove(filePath);
      }
    }

    return true;
  } catch (error) {
    errorCatcher(error, {
      contexts: {
        fn: {
          name: 'removeLegacyJwIconsFont',
        },
      },
    });
    return false;
  }
};
