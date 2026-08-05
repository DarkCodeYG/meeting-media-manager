import { describe, expect, it, vi } from 'vitest';

// Deliberately does NOT mock 'upath': this suite verifies real path resolution
// semantics, which is the whole point of the Zip Slip guard. Everything else is
// mocked only so that importing '../fs' does not pull in Electron at test time.

vi.mock('chokidar', () => ({
  watch: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('fs-extra', () => ({
  ensureDir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn(() => Promise.resolve()),
}));

vi.mock('src-electron/main/utils', () => ({
  addElectronBreadcrumb: vi.fn(),
  captureElectronError: vi.fn(),
  getSharedDataPath: vi.fn(),
}));

vi.mock('src-electron/main/window/window-base', () => ({
  sendToWindow: vi.fn(),
}));

vi.mock('src-electron/main/window/window-main', () => ({
  mainWindowInfo: {},
}));

vi.mock('src/constants/media', () => ({
  IMG_EXTENSIONS: [],
  JWPUB_EXTENSIONS: [],
  PDF_EXTENSIONS: [],
}));

vi.mock('src/shared/vanilla', () => ({
  log: vi.fn(),
  uuid: vi.fn(() => 'test-uuid'),
}));

vi.mock('yauzl', () => ({
  default: {},
}));

import { join } from 'upath';

import { isSafeZipEntryPath } from '../fs';

const OUTPUT = '/tmp/extract-target';

describe('isSafeZipEntryPath', () => {
  it('accepts entries that stay inside the output directory', () => {
    for (const entry of [
      'file.txt',
      'nested/file.txt',
      'deeply/nested/dir/file.txt',
      'dir/../file.txt', // normalizes back inside
      './file.txt',
    ]) {
      expect(isSafeZipEntryPath(OUTPUT, join(OUTPUT, entry))).toBe(true);
    }
  });

  it('accepts the output directory itself', () => {
    expect(isSafeZipEntryPath(OUTPUT, OUTPUT)).toBe(true);
  });

  it('rejects entries that escape via ../ sequences', () => {
    for (const entry of [
      '../evil.txt',
      '../../evil.txt',
      'nested/../../evil.txt',
      '../../../../../../etc/passwd',
    ]) {
      expect(isSafeZipEntryPath(OUTPUT, join(OUTPUT, entry))).toBe(false);
    }
  });

  it('rejects a sibling directory sharing the output prefix', () => {
    // A plain startsWith(resolvedOutput) check without the trailing separator
    // would wrongly accept this.
    expect(
      isSafeZipEntryPath(OUTPUT, '/tmp/extract-target-evil/file.txt'),
    ).toBe(false);
  });

  it('rejects absolute paths outside the output directory', () => {
    expect(isSafeZipEntryPath(OUTPUT, '/etc/passwd')).toBe(false);
  });
});
