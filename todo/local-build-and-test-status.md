# Windows 로컬 개발 환경 / 빌드 / 테스트 상태

- **최초 작성**: 2026-08-05
- **최종 갱신**: 2026-08-05 (빌드 도구 설치 후)

## 1. 환경 구성 — 완료

| 항목                | 상태                     | 위치 / 비고                                                          |
| ------------------- | ------------------------ | -------------------------------------------------------------------- |
| Node.js             | ✅ v24.19.0              | fnm 설치. `package.json` 요구 `^24.14.0` 충족                        |
| fnm                 | ✅ v1.39.0               | `%LOCALAPPDATA%\fnm`, 사용자 PATH 등록                               |
| PowerShell 프로필   | ✅                       | `fnm env --use-on-cd --shell power-shell` 초기화 라인 추가           |
| Yarn                | ✅ 4.13.0                | corepack 심 + 리포지토리 번들                                        |
| 의존성              | ✅ 1545 패키지 (955 MiB) |                                                                      |
| Python              | ✅ 3.12.10               | `%LOCALAPPDATA%\Programs\Python\Python312` (사용자 설치, UAC 불필요) |
| VS 2022 Build Tools | ✅ 17.14.37516           | `D:\VS\BuildTools` — MSVC v143 14.44.35207                           |
| Windows SDK         | ✅ 10.0.22621.0          | `C:\Program Files (x86)\Windows Kits\10`                             |
| `quasar prepare`    | ✅                       |                                                                      |
| `generate:icons`    | ✅                       | fantasticon                                                          |
| `generate:logos`    | ✅                       | icongenie — `src-electron/icons` 에 12개 생성                        |
| `electron-rebuild`  | ✅                       | `better-sqlite3` + `@jitsi/robotjs` 모두 성공                        |

### 설치 시 주의사항 (재설치할 경우)

- **C: 여유 공간이 7.5 GB뿐이었습니다.** 그래서 VS 빌드 도구를 전체 VCTools 워크로드가 아닌 최소 컴포넌트 2개로, 설치 위치도 D:로 지정했습니다:
  ```powershell
  vs_BuildTools.exe --quiet --wait --norestart --nocache `
    --installPath D:\VS\BuildTools `
    --path shared=D:\VS\Shared --path cache=D:\VS\cache `
    --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    --add Microsoft.VisualStudio.Component.Windows11SDK.22621
  ```
  Windows SDK 일부는 `C:\Program Files (x86)\Windows Kits` 로 강제되어 C:를 사용합니다. 설치 후 C: 여유는 7.1 GB.
- 설치 관리자 종료 코드는 **3010**(성공, 재부팅 권장)이었으나 **재부팅 없이 네이티브 리빌드가 정상 동작**합니다.
- 비관리자 셸에서 실행하면 UAC 창이 뜹니다. `winget` 은 이 머신에 없습니다.
- **`yarn generate:logos` 는 최초 1회 필수입니다.** `src-electron/icons` 는 `.gitkeep` 만 커밋되어 있고 나머지는 `.gitignore:67` 로 제외되어 있어, 실행하지 않으면 electron-builder가 NSIS 단계에서 `icon directory ... doesn't contain icons` 로 실패합니다.

## 2. 빌드 (`yarn build`)

Windows 타깃은 [quasar.config.ts:171](../quasar.config.ts#L171) 에서 `nsis` x64.

빌드 파이프라인 통과 현황:

- Electron UI (Vite) 컴파일 ✅ — JS 79파일 4031 KB, CSS 8파일 216 KB
- Electron Main / Preload (esbuild) ✅
- `dist/electron/UnPackaged` 프로덕션 의존성 설치 ✅
- `@electron/rebuild` 네이티브 모듈 (electron 41.1.1, x64) ✅
- `win-unpacked` 패키징 + asar integrity ✅
- NSIS 인스톨러 — `generate:logos` 실행 후 진행 가능

### 빌드 중 나오는 무해한 경고

- `npm error extraneous: ...` / `npm error missing: electron@>=30.3.0, required by electron-dl-manager` — electron-builder의 의존성 수집기가 `dist/electron/UnPackaged` 에서 npm으로 트리를 검사하며 내는 경고입니다. 업스트림이 `1d1d312a1 chore: add electron to second package.json` 로 정리했으므로 동기화 시 사라집니다.
- `cannot find path for dependency electron@undefined` — 위와 동일 원인.
- `DEP0190 DeprecationWarning: Passing args to a child process with shell option true` — `@electron/rebuild` 내부.
- 자동 업데이트 코드 서명 오류 — 로컬 빌드에서는 정상 (CLAUDE.md 명시).

## 3. 단위 테스트 (`yarn test:unit --run`)

기준선: **233 통과 / 2 실패** (28 파일 중 2 실패). 보안 패치 적용 후에도 동일 — 회귀 없음.
추가한 보안 테스트 22개는 전부 통과.

> `--reporter=basic` 은 vitest 4에서 제거되었습니다. 사용하면 `Failed to load custom Reporter from basic` 로 실패합니다.

### 3.1 `src/__tests__/locales.test.ts` — 미사용 번역 키 (미해결, 포크 버그)

```
AssertionError: The following translation keys are unused: reset-playback-speed, speaker-name
```

- [src/i18n/en.json:544](../src/i18n/en.json#L544) `"reset-playback-speed"`
- [src/i18n/en.json:618](../src/i18n/en.json#L618) `"speaker-name"`
- `src/**/*.{vue,ts}` 전체에서 참조 **0건**.

포크가 추가한 playback speed / speaker info 기능의 잔여 키입니다. 과거 유사 정리 커밋(`8a8aea709`)이 있어 회귀에 해당합니다.

**할 일**: 두 키를 실제로 쓸지 결정 → 사용하거나 전 로케일에서 제거. (비영어 파일은 Crowdin 관리 방침이므로 `en.json` 우선)

### 3.2 `src/utils/__tests__/api.test.ts` — 타임존 의존 (미해결, 업스트림 유래)

```
FAIL  fetchMemorials > filters out memorials that are more than one month old, ...
expected { '2024': '2024/03/24', '2025': '2025/04/12' } to deeply equal { '2025': '2025/04/12' }
```

원인: [api.test.ts:135-139](../src/utils/__tests__/api.test.ts#L135-L139) 의 목이 `new Date(value).toISOString().startsWith('2024-04-24')` 로 판정합니다.

- 프로덕션 코드는 `2024/03/24` + 1개월 = `2024/04/24` 를 `isInPast()` 로 검사.
- `new Date('2024/04/24')` 는 **로컬 시간** 자정 → KST(UTC+9)에서는 `2024-04-23T15:00:00Z` → `toISOString()` 이 `"2024-04-23…"` → 목이 `false` → 2024 항목이 걸러지지 않음.
- UTC/음수 오프셋 환경(CI)에서는 통과하므로 업스트림에서 드러나지 않았습니다.
- 목 구현은 **업스트림과 동일**(`git show upstream/master:src/utils/__tests__/api.test.ts` 확인) → 포크 회귀 아님.

**할 일(선택)**: `toISOString()` 대신 로컬 날짜 비교(`getFullYear/getMonth/getDate`)로 변경하면 타임존 무관해집니다. 업스트림 PR 가치 있음.

## 4. Lint (`yarn lint`)

`eslint && vue-tsc` 순서라 eslint가 실패하면 타입체크는 실행되지 않습니다 — 부분 통과를 성공으로 오독하지 마세요.

해소한 항목:

- `src-electron/main/window/window-main.ts` — `syncTimerWindowPosition` 미사용 (커밋 `95fe21412` 에서 `move`/`moved` 이벤트에 연결)
- `test/vitest/mocks/electronApi.ts` — `pauseAllDownloads` 누락 (커밋 `ded37d5b9`)
- `src/pages/MediaCalendarPage.vue:1052` — `parseInt(string | undefined)` (커밋 `ded37d5b9`)

남은 경고: `MediaPlayerPage.vue:39` `vue/no-v-html` — 경고 레벨, 빌드 차단 안 함.

## 5. 재현 명령

```powershell
# 새 셸에서는 프로필이 fnm을 초기화하므로 아래 PATH 지정은 불필요
$node = "$env:APPDATA\fnm\node-versions\v24.19.0\installation"
$py   = "$env:LOCALAPPDATA\Programs\Python\Python312"
$env:PATH = "$node;$py;$py\Scripts;$env:PATH"

cd d:\git\m3
yarn install
yarn generate:logos     # 최초 1회 (아이콘 없으면 NSIS 단계 실패)
yarn build
yarn test:unit --run
yarn lint
```
