import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('fs-extra/esm', () => ({
  pathExists: vi.fn(async () => false),
}));

vi.mock('node:fs/promises', () => ({
  rm: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ mtimeMs: 100, size: 100 })),
}));

const ffmpegOnMap: Record<string, (...args: unknown[]) => void> = {};
const outputOptionsCalls: unknown[][] = [];
const ffmpegChain = {
  noVideo: vi.fn().mockReturnThis(),
  on: vi
    .fn()
    .mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      ffmpegOnMap[event] = cb;
      return ffmpegChain;
    }),
  outputOptions: vi.fn().mockImplementation((...args: unknown[]) => {
    outputOptionsCalls.push(args);
    return ffmpegChain;
  }),
  save: vi.fn().mockReturnThis(),
};

vi.mock('fluent-ffmpeg', () => ({
  default: Object.assign(
    function ffmpeg() {
      return ffmpegChain;
    },
    { setFfmpegPath: vi.fn() },
  ),
}));

import { extractSubtitles } from '../ffmpeg';

/** Drives the mocked ffmpeg chain to its 'end' or 'error' callback. */
const settleFfmpeg = (outcome: 'end' | 'error') =>
  setTimeout(() => {
    ffmpegOnMap[outcome]?.(
      outcome === 'error' ? new Error('no subtitle stream') : undefined,
    );
  }, 0);

describe('ffmpeg.extractSubtitles', () => {
  // mockReset rather than clearAllMocks: leftover mockResolvedValueOnce entries
  // would otherwise leak into the next test and change which branch it takes.
  beforeEach(async () => {
    vi.clearAllMocks();
    outputOptionsCalls.length = 0;
    const { pathExists } = await import('fs-extra/esm');
    (pathExists as unknown as Mock).mockReset().mockResolvedValue(false);
    const { rm, stat } = await import('node:fs/promises');
    (rm as unknown as Mock).mockReset().mockResolvedValue(undefined);
    (stat as unknown as Mock)
      .mockReset()
      .mockResolvedValue({ mtimeMs: 100, size: 100 });
  });

  it('returns the generated .vtt path and asks ffmpeg for the first subtitle stream as webvtt', async () => {
    settleFfmpeg('end');
    const out = await extractSubtitles('/tmp/talk.mp4', '/bin/ffmpeg');

    expect(out).toBe('/tmp/talk.vtt');
    expect(outputOptionsCalls).toEqual([
      ['-map', '0:s:0'],
      ['-c:s', 'webvtt'],
    ]);
  });

  it('writes into outputDir when one is given, leaving the source folder untouched', async () => {
    settleFfmpeg('end');
    const out = await extractSubtitles(
      '/media/talk.mp4',
      '/bin/ffmpeg',
      '/cache',
    );

    expect(out.startsWith('/cache/talk-')).toBe(true);
    expect(out.endsWith('.vtt')).toBe(true);
  });

  it('reports "no subtitles" instead of throwing when the video has no subtitle track', async () => {
    settleFfmpeg('error');
    const out = await extractSubtitles('/tmp/nosubs.mp4', '/bin/ffmpeg');

    expect(out).toBe('');
    const { rm } = await import('node:fs/promises');
    expect(rm as unknown as Mock).toHaveBeenCalled();
  });

  it('reports "no subtitles" when ffmpeg succeeds but writes an empty file', async () => {
    // pathExists defaults to false, so no reuse check runs and this is the only
    // stat call: the size check on the freshly written file.
    const { stat } = await import('node:fs/promises');
    (stat as unknown as Mock).mockResolvedValue({ mtimeMs: 1, size: 0 });

    settleFfmpeg('end');
    const out = await extractSubtitles('/tmp/empty.mp4', '/bin/ffmpeg');

    expect(out).toBe('');
    expect(ffmpegChain.save).toHaveBeenCalled();
  });

  it('reuses an up-to-date extraction instead of running ffmpeg again', async () => {
    const { pathExists } = await import('fs-extra/esm');
    (pathExists as unknown as Mock).mockResolvedValue(true);
    const { stat } = await import('node:fs/promises');
    // Existing .vtt newer than the source and non-empty => reuse it.
    (stat as unknown as Mock)
      .mockResolvedValueOnce({ mtimeMs: 1, size: 100 })
      .mockResolvedValueOnce({ mtimeMs: 999, size: 50 });

    const out = await extractSubtitles('/tmp/cached.mp4', '/bin/ffmpeg');

    expect(out).toBe('/tmp/cached.vtt');
    expect(ffmpegChain.save).not.toHaveBeenCalled();
  });
});
