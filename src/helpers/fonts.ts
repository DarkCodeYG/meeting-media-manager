import type { FontName } from 'src/types';

import { Buffer } from 'buffer/';
import { create, type Font } from 'fontkit';
import {
  fallbackJwIconsGlyphMap,
  keywordToJwIconMapping,
} from 'src/constants/jw-icons';
import { errorCatcher } from 'src/helpers/error-catcher';
import { fetchRaw } from 'src/utils/api';
import { getFontsPath } from 'src/utils/fs';
import { useJwStore } from 'stores/jw';

const { fs, path } = globalThis.electronApi;
const { ensureDir, exists, readFile, stat, writeFile } = fs;
const { join } = path;

let jwIconsGlyphMapPromise: null | Promise<void> = null;
let jwIconsGlyphMap: null | Record<string, string> = null;

const fontFacePromises: Partial<Record<FontName, Promise<boolean>>> = {};
const localFontPathPromises: Partial<Record<FontName, Promise<string>>> = {};

const buildJwIconsMap = async (fontPath: string) => {
  if (jwIconsGlyphMap) return;
  if (jwIconsGlyphMapPromise) return jwIconsGlyphMapPromise;

  jwIconsGlyphMapPromise = (async () => {
    try {
      const buffer = await readFile(fontPath);
      const font = create(buffer) as Font;
      const characterSet = font.characterSet; // id: dec code point
      const map: Record<string, string> = {};
      let unusedGlyphs = 0;
      for (let i = 0; i < font.numGlyphs; i++) {
        const glyph = font.getGlyph(i);
        if (['.notdef', '.null', 'nonmarkingreturn'].includes(glyph.name)) {
          unusedGlyphs++;
          continue;
        }
        const codePoint = characterSet[glyph.id - unusedGlyphs];
        if (glyph.name && codePoint) {
          map[glyph.name] = String.fromCodePoint(codePoint);
        }
      }
      jwIconsGlyphMap = map;
    } catch (error) {
      errorCatcher(error, {
        contexts: { fn: { fontPath, name: 'buildJwIconsMap' } },
      });
      jwIconsGlyphMap = fallbackJwIconsGlyphMap;
    }
  })();
  return jwIconsGlyphMapPromise;
};

export const getJwIconFromKeyword = (keyword: number | string | undefined) => {
  if (!keyword) return '';
  const icon = keywordToJwIconMapping[keyword.toString()];
  if (!icon) return '';
  return jwIconsGlyphMap?.[icon] || fallbackJwIconsGlyphMap[icon] || '';
};

// Yeartext font-family definitions per writing script
// Reference: https://www.jw.org yeartext CSS (jwac.ms-* classes)
interface YeartextFontConfig {
  cdnFont?: FontName;
  fontFamily: string;
}

const YEARTEXT_FONTS: Record<string, YeartextFontConfig> = {
  ARABIC: {
    fontFamily:
      "'Noto Naskh Arabic Variable', 'Noto Serif Variable', 'Simplified Arabic', serif",
  },
  ARMENIAN: {
    fontFamily: "'Noto Serif Armenian Variable', 'Noto Serif Variable', serif",
  },
  ASSYRIAN: { fontFamily: "'Noto Serif Variable', Georgia, serif" },
  BENGALI: {
    fontFamily:
      "'Noto Sans Bengali Variable', 'Noto Sans Variable', sans-serif",
  },
  CAMBODIAN: {
    fontFamily: "'Noto Serif Khmer Variable', 'Noto Serif Variable', serif",
  },
  CHINESE: {
    fontFamily:
      "'Noto Sans SC', 'Microsoft YaHei', 'Heiti SC', 'Noto Sans Variable', sans-serif",
  },
  CYRILLIC: { fontFamily: "'Wt-ClearText-Bold', serif" },
  DEVANAGARI: {
    fontFamily:
      "'Noto Serif Devanagari Variable', 'Noto Serif Variable', serif",
  },
  ETHIOPIC: { fontFamily: "'Abyssinica SIL', sans-serif" },
  GEORGIAN: {
    cdnFont: 'WTClearTextGeorgian',
    fontFamily: "'WTClearTextGeorgian', 'Noto Serif Variable', serif",
  },
  GREEK: { fontFamily: "'Wt-ClearText-Bold', serif" },
  GUJARATI: {
    fontFamily: "'Noto Serif Gujarati Variable', 'Noto Serif Variable', serif",
  },
  GURMUKHI: {
    fontFamily: "'Noto Sans Gurmukhi Variable', 'Noto Sans Variable', Raavi",
  },
  HEBREW: {
    fontFamily: "'Noto Serif Hebrew Variable', 'Noto Serif Variable', serif",
  },
  JAPANESE: {
    cdnFont: 'WTClearTextJapanese',
    fontFamily: "'WTClearTextJapanese', serif",
  },
  KANNADA: {
    fontFamily: "'Noto Serif Kannada Variable', 'Noto Serif Variable', serif",
  },
  KOREAN: {
    cdnFont: 'Wt-BaeumMyungjo',
    fontFamily: "'Wt-BaeumMyungjo', serif",
  },
  LAOTIAN: {
    cdnFont: 'WTSetthaSpecial',
    fontFamily: "'WTSetthaSpecial', 'Dok Champa', sans-serif",
  },
  MALAYALAM: {
    fontFamily:
      "'Noto Sans Malayalam Variable', 'Noto Sans Variable', Kartika, sans-serif",
  },
  MONGOLIAN: {
    cdnFont: 'WTMannaSansMongolian',
    fontFamily:
      "'WTMannaSansMongolian', 'Noto Sans SC Variable', 'Noto Sans Variable'",
  },
  MYANMAR: {
    cdnFont: 'WTMannaSansMyanmar',
    fontFamily:
      "'WTMannaSansMyanmar', 'Noto Sans Variable', 'Myanmar Sangam MN', 'Myanmar MN', sans-serif",
  },
  ORIYA: {
    fontFamily:
      "'Noto Sans Oriya Variable', 'Noto Sans Variable', 'Oriya Sangam MN', Kalinga, sans-serif",
  },
  ROMAN: { fontFamily: "'Wt-ClearText-Bold', serif" },
  SINDHI: { fontFamily: "'Noto Serif Variable', Georgia, serif" },
  SINHALESE: {
    fontFamily: "'Noto Serif Sinhala Variable', 'Noto Serif Variable', serif",
  },
  TAMIL: {
    fontFamily:
      "'Noto Sans Tamil Variable', 'Noto Sans Variable', Latha, 'Inai Mathi', sans-serif",
  },
  TELUGU: {
    fontFamily:
      "'Noto Sans Telugu Variable', 'Noto Sans Variable', Gautami, 'Iskoola Pota', Vani, sans-serif",
  },
  THAI: {
    cdnFont: 'WTTextNew',
    fontFamily: "'WTTextNew', serif",
  },
  TIBETAN: {
    cdnFont: 'WTMannaSansTibetan',
    fontFamily: "'WTMannaSansTibetan', 'Noto Sans Variable', sans-serif",
  },
  URDU: {
    fontFamily:
      "'Noto Nastaliq Urdu Variable', 'Noto Sans Variable', 'Jameel Noori Nastaleeq'",
  },
};

const DEFAULT_YEARTEXT_FONT: YeartextFontConfig = {
  fontFamily: "'Wt-ClearText-Bold', 'Noto Serif Variable', serif",
};

/**
 * Load the appropriate yeartext font based on writing script and language code.
 * Checks for language-specific overrides (e.g., CHINESE.CHC → NotoSansTC)
 * discovered dynamically from JW.org CSS.
 * Returns the CSS font-family string to apply.
 */
export const loadYeartextFont = async (
  script?: string,
  langCode?: string,
): Promise<string> => {
  if (!script) return DEFAULT_YEARTEXT_FONT.fontFamily;

  const jwStore = useJwStore();

  // Check for language-specific override from JW.org CSS
  if (langCode) {
    const overrideKey = `${script.toUpperCase()}.${langCode.toUpperCase()}`;
    const override = jwStore.yeartextFontOverrides[overrideKey];
    if (override) return override;
  }

  const config = YEARTEXT_FONTS[script.toUpperCase()] || DEFAULT_YEARTEXT_FONT;
  if (config.cdnFont) {
    // Ensure CDN font URL is available before loading
    if (!jwStore.fontUrls[config.cdnFont]) {
      await jwStore.updateYeartextFontUrls();
    }
    await setElementFont(config.cdnFont);
  }
  return config.fontFamily;
};

export const setElementFont = async (fontName: FontName) => {
  if (!fontName) return false;

  if (fontFacePromises[fontName]) return fontFacePromises[fontName];

  fontFacePromises[fontName] = (async () => {
    try {
      const fontPath = await getLocalFontPath(fontName);
      const fontFace = new FontFace(fontName, 'url("' + fontPath + '")');
      await fontFace.load();
      document.fonts.add(fontFace);

      if (fontName === 'JW-Icons') {
        await buildJwIconsMap(fontPath);
      }
      return true;
    } catch (error) {
      errorCatcher(error, {
        contexts: { fn: { fontName, name: 'setElementFont first try' } },
      });
      const url = useJwStore().fontUrls[fontName] || '';
      const fallbackLoaded = await setFallbackFont(fontName, url);

      if (!fallbackLoaded) {
        errorCatcher(error, {
          contexts: { fn: { fontName, name: 'setElementFont fallback', url } },
        });
        fontFacePromises[fontName] = undefined;
      }

      return fallbackLoaded;
    }
  })();

  return fontFacePromises[fontName];
};

const setFallbackFont = async (
  fontName: FontName,
  url: string,
): Promise<boolean> => {
  try {
    const fontFace = new FontFace(fontName, 'url("' + url + '")');
    await fontFace.load();
    document.fonts.add(fontFace);
    return true;
  } catch (e) {
    errorCatcher(e, {
      contexts: { fn: { fontName, name: 'setFallbackFont', url } },
    });
    return false;
  }
};

const withTimeout = async <T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(id);
  }
};

const needsDownload = async (
  fontPath: string,
  fontName: FontName,
): Promise<boolean> => {
  if (!(await exists(fontPath))) return true;

  const store = useJwStore();
  const url = store.fontUrls[fontName] || '';
  if (!url) return false;

  try {
    const head = await withTimeout(5000, (signal) =>
      fetchRaw(url, { method: 'HEAD', signal }, true),
    );

    if (!head.ok) {
      if (fontName === 'JW-Icons') {
        await store.updateJwIconsUrl();
        return needsDownload(fontPath, fontName);
      }
      return false;
    }

    const remoteSize = head.headers.get('content-length');
    if (!remoteSize) return true;

    const localSize = (await stat(fontPath)).size;
    return Number.parseInt(remoteSize, 10) !== localSize;
  } catch {
    return false;
  }
};

const downloadFont = async (fontPath: string, fontName: FontName) => {
  const store = useJwStore();

  const fontUrl = store.fontUrls[fontName] || '';
  const fetchFont = async () =>
    withTimeout(30000, (signal) =>
      fetchRaw(fontUrl, { method: 'GET', signal }),
    );

  let response = await fetchFont();

  if (!response.ok && fontName === 'JW-Icons') {
    await store.updateJwIconsUrl();
    response = await fetchFont();
  }

  if (!response.ok) {
    throw new Error(
      `Failed to download font: ${response.statusText || response.status}`,
    );
  }

  const buffer = Buffer.from(await (await response.blob()).arrayBuffer());
  await writeFile(fontPath, buffer);
};

export const getLocalFontPath = async (fontName: FontName) => {
  if (localFontPathPromises[fontName]) return localFontPathPromises[fontName];

  localFontPathPromises[fontName] = (async () => {
    const fontsDir = await getFontsPath();
    const fontFileName = `${fontName}.woff2`;
    const fontPath = join(fontsDir, fontFileName);

    try {
      if (await needsDownload(fontPath, fontName)) {
        await ensureDir(fontsDir);
        await downloadFont(fontPath, fontName);
      }
    } catch (error) {
      errorCatcher(error, {
        contexts: {
          fn: {
            fontFileName,
            fontName,
            fontPath,
            fontsDir,
            name: 'getLocalFontPath',
            url: useJwStore().fontUrls[fontName],
          },
        },
      });

      if (!(await exists(fontPath))) {
        throw new Error(
          `Failed to download font ${fontName} and no local copy exists`,
          { cause: error },
        );
      }
    }

    return fontPath;
  })();

  return localFontPathPromises[fontName];
};
