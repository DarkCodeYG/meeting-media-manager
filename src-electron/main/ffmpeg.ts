import { pathExists } from 'fs-extra/esm';
import { createHash } from 'node:crypto';
import { rm as remove, stat } from 'node:fs/promises';
import { FULL_HD } from 'src/constants/media';
import { basename, changeExt, extname, join } from 'upath';

const conversionQueue = new Map<string, Promise<string>>();
const subtitleQueue = new Map<string, Promise<string>>();

const shouldUseExistingConversion = async (
  originalFile: string,
  convertedFilePath: string,
): Promise<boolean> => {
  if (!(await pathExists(convertedFilePath))) {
    return false;
  }

  const sourceStats = await stat(originalFile);
  const destStats = await stat(convertedFilePath);

  return destStats.mtimeMs > sourceStats.mtimeMs && destStats.size > 0;
};

const convertAudioToVideo = async (
  ffmpegPath: string,
  originalFile: string,
  convertedFilePath: string,
): Promise<void> => {
  const { default: ffmpeg } = await import('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegPath);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(originalFile)
      .noVideo()
      .save(convertedFilePath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
};

const convertImageToVideo = async (
  ffmpegPath: string,
  originalFile: string,
  convertedFilePath: string,
): Promise<void> => {
  const { default: ffmpeg } = await import('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegPath);

  const { imageSizeFromFile } = await import('image-size/fromFile');
  const { height, orientation, width } = await imageSizeFromFile(originalFile);

  const adjustedDimensions = getAdjustedDimensions(width, height, orientation);
  const convertedDimensions = resize(
    adjustedDimensions.width,
    adjustedDimensions.height,
    getMaxWidth(adjustedDimensions),
    getMaxHeight(adjustedDimensions),
  );

  if (!convertedDimensions) {
    throw new Error('Could not determine dimensions of image.');
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg(originalFile)
      .inputOptions('-loop 1')
      .inputFormat('image2')
      .videoCodec('libx264')
      .size(`${convertedDimensions.width}x${convertedDimensions.height}`)
      .loop(5)
      .outputOptions('-pix_fmt', 'yuv420p')
      .outputOptions('-r', '30')
      .save(convertedFilePath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
};

const getAdjustedDimensions = (
  width: number | undefined,
  height: number | undefined,
  orientation: number | undefined,
): { height: number; width: number } => {
  if (!width || !height) {
    throw new Error('Could not determine dimensions of image.');
  }

  const shouldSwapDimensions = orientation && orientation >= 5;
  return shouldSwapDimensions
    ? { height: width, width: height }
    : { height, width };
};

const getMaxWidth = (dimensions: {
  height: number;
  width: number;
}): number | undefined => {
  const aspectRatio = FULL_HD.height / FULL_HD.width;
  const imageAspectRatio = dimensions.height / dimensions.width;

  if (aspectRatio <= imageAspectRatio) {
    return Math.min(FULL_HD.width, dimensions.width);
  }
  return undefined;
};

const getMaxHeight = (dimensions: {
  height: number;
  width: number;
}): number | undefined => {
  const aspectRatio = FULL_HD.height / FULL_HD.width;
  const imageAspectRatio = dimensions.height / dimensions.width;

  if (aspectRatio > imageAspectRatio) {
    return Math.min(FULL_HD.height, dimensions.height);
  }
  return undefined;
};

/**
 * Extracts the first embedded subtitle track of a video into a WebVTT file.
 *
 * Chromium does not expose subtitle tracks that live inside the container, so a
 * soft-subtitled video shows nothing unless the track is pulled out into a file
 * that can be attached with a `<track>` element.
 *
 * @param videoPath The video to read the subtitle track from
 * @param ffmpegPath Path to the FFmpeg executable
 * @param outputDir Directory for the generated .vtt; defaults to alongside the video
 * @returns Path to the .vtt file, or an empty string when there is no usable
 *   text subtitle track. Videos with no subtitles, or with bitmap-only tracks
 *   (DVD/Blu-ray), are an expected outcome rather than an error.
 */
export const extractSubtitles = async (
  videoPath: string,
  ffmpegPath: string,
  outputDir?: string,
): Promise<string> => {
  const existingPromise = subtitleQueue.get(videoPath);
  if (existingPromise) return existingPromise;

  const extractionPromise = (async (): Promise<string> => {
    const subtitlesPath = outputDir
      ? join(
          outputDir,
          `${basename(videoPath, extname(videoPath))}-${createHash('sha1')
            .update(videoPath)
            .digest('hex')
            .slice(0, 8)}.vtt`,
        )
      : changeExt(videoPath, '.vtt');

    if (await shouldUseExistingConversion(videoPath, subtitlesPath)) {
      return subtitlesPath;
    }

    const { default: ffmpeg } = await import('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions('-map', '0:s:0') // first subtitle stream
          .outputOptions('-c:s', 'webvtt')
          .save(subtitlesPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
    } catch {
      // No subtitle stream, or one that cannot become text (bitmap subtitles).
      // Remove the empty file ffmpeg may have created and report "none found".
      await remove(subtitlesPath).catch(() => undefined);
      return '';
    }

    // ffmpeg can exit successfully having written nothing useful.
    const written = await stat(subtitlesPath).catch(() => null);
    if (!written?.size) {
      await remove(subtitlesPath).catch(() => undefined);
      return '';
    }

    return subtitlesPath;
  })();

  subtitleQueue.set(videoPath, extractionPromise);

  try {
    return await extractionPromise;
  } finally {
    subtitleQueue.delete(videoPath);
  }
};

export const createVideoFromNonVideo = async (
  originalFile: string,
  ffmpegPath: string,
  outputDir?: string,
): Promise<string> => {
  const existingPromise = conversionQueue.get(originalFile);
  if (existingPromise) return existingPromise;

  const conversionPromise = (async (): Promise<string> => {
    const convertedFilePath = outputDir
      ? join(
          outputDir,
          `${basename(originalFile, extname(originalFile))}-${createHash('sha1')
            .update(originalFile)
            .digest('hex')
            .slice(0, 8)}.mp4`,
        )
      : changeExt(originalFile, '.mp4');

    const canReuse = await shouldUseExistingConversion(
      originalFile,
      convertedFilePath,
    );

    if (!canReuse) {
      if (originalFile.toLowerCase().endsWith('.mp3')) {
        await convertAudioToVideo(ffmpegPath, originalFile, convertedFilePath);
      } else {
        await convertImageToVideo(ffmpegPath, originalFile, convertedFilePath);
      }
    }

    return convertedFilePath;
  })();

  conversionQueue.set(originalFile, conversionPromise);

  try {
    return await conversionPromise;
  } finally {
    conversionQueue.delete(originalFile);
  }
};

const resize = (
  x: number,
  y: number,
  xMax?: number,
  yMax?: number,
): { height: number; width: number } => {
  // Set default values for xMax and yMax if they are undefined
  const maxX = xMax ?? Infinity; // Use Infinity if no max value is provided
  const maxY = yMax ?? Infinity;

  if (maxX === Infinity && maxY === Infinity) {
    throw new Error('No maximum values given.');
  }

  if (maxX !== Infinity && (maxY === Infinity || x / y > maxX / maxY)) {
    // Width constrained or aspect ratio favors width.
    return {
      height: Math.round((maxX * y) / x),
      width: maxX,
    };
  }

  // Height constrained or aspect ratio favors height.
  return {
    height: maxY,
    width: Math.round((maxY * x) / y),
  };
};
