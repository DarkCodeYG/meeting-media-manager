import { srtToVtt } from 'src/helpers/fs';
import { describe, expect, it } from 'vitest';

const BOM = String.fromCharCode(0xfeff);

describe('srtToVtt', () => {
  it('adds the WEBVTT header', () => {
    expect(srtToVtt('1\n00:00:01,000 --> 00:00:02,000\nHello\n')).toMatch(
      /^WEBVTT\n\n/,
    );
  });

  it('converts comma decimal separators in timestamps to periods', () => {
    const out = srtToVtt('1\n00:01:02,500 --> 00:01:05,750\nHello\n');
    expect(out).toContain('00:01:02.500 --> 00:01:05.750');
    expect(out).not.toContain(',500');
  });

  it('converts every cue, not just the first', () => {
    const out = srtToVtt(
      [
        '1',
        '00:00:01,000 --> 00:00:02,000',
        'One',
        '',
        '2',
        '00:00:03,250 --> 00:00:04,500',
        'Two',
        '',
      ].join('\n'),
    );
    expect(out).toContain('00:00:01.000 --> 00:00:02.000');
    expect(out).toContain('00:00:03.250 --> 00:00:04.500');
  });

  it('normalizes CRLF line endings', () => {
    const out = srtToVtt('1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n');
    expect(out).not.toContain('\r');
    expect(out).toContain('00:00:01.000 --> 00:00:02.000');
  });

  it('tolerates a leading byte order mark', () => {
    const out = srtToVtt(`${BOM}1\n00:00:01,000 --> 00:00:02,000\nHello\n`);
    expect(out.startsWith('WEBVTT')).toBe(true);
    expect(out).not.toContain(BOM);
  });

  it('keeps the cue text', () => {
    expect(srtToVtt('1\n00:00:01,000 --> 00:00:02,000\nAnnyeong\n')).toContain(
      'Annyeong',
    );
  });

  it('handles arrows with irregular spacing', () => {
    const out = srtToVtt('1\n00:00:01,000-->00:00:02,000\nHello\n');
    expect(out).toContain('00:00:01.000 --> 00:00:02.000');
  });
});
