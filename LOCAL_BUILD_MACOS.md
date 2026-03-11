# Local Build Guide for macOS

This document records the issues encountered when building locally on macOS and their solutions.

## Environment

- macOS (Apple Silicon / Intel)
- Node.js `^22.19.0`
- Yarn `^4.7.0`

---

## Initial Setup

### 1. Install Node.js

```bash
brew install node@22
```

Node.js may not be automatically added to PATH. Add the following to `~/.zshrc`:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Generate App Icons (first time only)

The build will fail if the `src-electron/icons/` directory is empty.

```bash
yarn generate:logos
```

### 4. Build

```bash
yarn build
```

---

## Known Issues and Solutions

### Issue 1: `electron-preload.cjs` File Conflict — Blank Screen

**Symptom:** The app launches but the window displays nothing (blank screen).

**Cause:** When `src-electron/electron-preload.cjs` (a Node.js 22 compatibility shim) exists, esbuild's CJS format build resolves it over `electron-preload.ts` due to extension priority (`.cjs` > `.ts`). This causes the empty shim file to be used as the preload script instead of the real one, resulting in `window.electronApi` being undefined and the Vue app initialization silently failing.

**Solution:** Delete `src-electron/electron-preload.cjs`.

```bash
rm src-electron/electron-preload.cjs
```

---

### Issue 2: `yarn workspaces focus` Failure — Build Error

**Symptom:**

```
Error: @sentry/electron@patch:...: ENOENT: no such file or directory,
open '.../dist/electron/UnPackaged/.yarn/patches/@sentry-electron-npm-7.10.0-e9b4c924be.patch'
```

**Cause:** During the Quasar build process, `package.json` and `yarn.lock` are generated in `dist/electron/UnPackaged/`. Yarn treats this directory as an independent project root. The `@sentry/electron` patch path (`~/.yarn/patches/`) in `package.json` is resolved relative to the UnPackaged directory, so the patch file cannot be found. This is further aggravated if the `.yarn/patches/` directory is not committed to git.

**Solution:** Add a `beforePackaging` hook in `quasar.config.ts` that copies the patch files and Yarn binary to the UnPackaged directory before running Yarn. The hook is guarded by `process.env.CI` to preserve existing behavior in CI environments.

```typescript
// quasar.config.ts - added to electron config (already applied)
...(!process.env.CI && {
  unPackagedInstallParams: ['--version'],
  beforePackaging: ({ unpackagedDir }) => {
    // Copies .yarn/patches and releases, then runs yarn workspaces focus
    // See quasar.config.ts for full implementation
  },
}),
```

---

### Issue 3: No Icons in `build/icons` Directory

**Symptom:**

```
icon directory .../build/icons doesn't contain icons
```

**Cause:** The `src-electron/icons/` directory is not included in git, so it is empty after a fresh clone.

**Solution:** Generate icons before building:

```bash
yarn generate:logos
```

---

### Issue 4: "Another instance is running. Exiting..." on Launch

**Symptom:** After an abnormal app termination, the SingletonLock file remains and blocks all subsequent launches.

**Solution:** Force kill the process:

```bash
pkill -9 -f "Meeting Media"
```

---

### Issue 5: Auto-Update Code Signature Error

**Symptom:**

```
Code signature did not pass validation: code failed to satisfy specified code requirement(s)
```

**Cause:** Local builds only have ad-hoc signing, which differs from the official release signed with an Apple Developer certificate. The Squirrel.Mac updater detects the signature mismatch and refuses to install the update.

**Impact:** No effect on app functionality. Only the auto-update feature is unavailable.

---

## Build Steps Summary

```bash
# Set PATH (each session, or add to ~/.zshrc)
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# First time only
yarn install
yarn generate:logos

# Build
yarn build

# Build output location
# dist/electron/Packaged/meeting-media-manager-*.dmg
```
