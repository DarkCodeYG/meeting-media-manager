import { applyDefaultCuePlacement, JW_CUE_SETTINGS } from 'src/shared/vanilla';
import { describe, expect, it } from 'vitest';

/**
 * Cue text is irrelevant to placement, so these use ASCII rather than the CJK
 * text the real files carry — it keeps the fixtures readable and immune to
 * mangling by whatever writes the file.
 */
describe('applyDefaultCuePlacement', () => {
  it('places a cue that carries no settings', () => {
    // The shape ffmpeg's webvtt muxer produces: MM:SS.mmm, no settings.
    const out = applyDefaultCuePlacement(
      'WEBVTT\n\n00:01.480 --> 00:03.065\nWelcome\n',
    );
    expect(out).toContain(`00:01.480 --> 00:03.065 ${JW_CUE_SETTINGS}`);
  });

  it('handles hour-length timestamps too', () => {
    const out = applyDefaultCuePlacement(
      'WEBVTT\n\n00:00:01.105 --> 00:00:02.231\nHello\n',
    );
    expect(out).toContain(`00:00:01.105 --> 00:00:02.231 ${JW_CUE_SETTINGS}`);
  });

  it('leaves a cue that already specifies placement untouched', () => {
    // Exactly what a JW-published .vtt looks like; rewriting it would be
    // overriding the subtitle author.
    const jw = `WEBVTT\n\n00:00:01.105 --> 00:00:02.231 ${JW_CUE_SETTINGS}\nPrayer\n`;
    expect(applyDefaultCuePlacement(jw)).toBe(jw);
  });

  it('respects placement that differs from the default', () => {
    const top = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000 line:10%\nSign here\n';
    expect(applyDefaultCuePlacement(top)).toBe(top);
  });

  it('places every cue, not just the first', () => {
    const out = applyDefaultCuePlacement(
      [
        'WEBVTT',
        '',
        '00:01.000 --> 00:02.000',
        'One',
        '',
        '00:03.000 --> 00:04.000',
        'Two',
        '',
      ].join('\n'),
    );
    expect(out.split(JW_CUE_SETTINGS)).toHaveLength(3);
  });

  it('does not touch the header, cue identifiers or cue text', () => {
    const out = applyDefaultCuePlacement(
      'WEBVTT\n\ncue-1\n00:01.000 --> 00:02.000\n1 --> 2 is not a timing\n',
    );
    expect(out).toContain('WEBVTT');
    expect(out).toContain('cue-1');
    expect(out).toContain('1 --> 2 is not a timing');
  });

  it('preserves a multi-line cue', () => {
    const out = applyDefaultCuePlacement(
      'WEBVTT\n\n00:01.000 --> 00:02.000\nline one\nline two\n',
    );
    expect(out).toContain('line one\nline two');
  });

  it('leaves non-CJK and CJK cue text alone alike', () => {
    const out = applyDefaultCuePlacement(
      'WEBVTT\n\n00:01.000 --> 00:02.000\n欢迎收看\n',
    );
    expect(out).toContain('欢迎收看');
  });
});
