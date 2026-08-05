# 포크 ↔ 업스트림 갭 분석 (2026-08-05 기준)

- **포크**: `DarkCodeYG/meeting-media-manager` @ `86e81174a` — `v26.4.7-custom.0`
- **업스트림**: `sircharlo/meeting-media-manager` @ `upstream/master` (2026-08-03) — `v26.7.9-beta.9`
- **분기점(merge-base)**: `2738d7526` (2026-04-05, `v26.4.3-beta.2`) → **약 4개월 경과**

## 1. 갭 규모

| 항목                                    | 값                                                          |
| --------------------------------------- | ----------------------------------------------------------- |
| 포크 전용 커밋                          | 137                                                         |
| 업스트림 전용 커밋                      | 2340 (비병합 1807)                                          |
| 업스트림 전용 커밋 중 실질 변경         | **407** (l10n/crowdin 952, 버전 범프 122, deps 봇 327 제외) |
| 포크가 수정한 파일                      | 129                                                         |
| 업스트림이 수정한 파일                  | 494                                                         |
| **양쪽이 모두 수정한 파일 (충돌 위험)** | **115 / 129 = 89%**                                         |
| 미반영 릴리스                           | v26.5.0, v26.6.0, v26.6.1, v26.7.0 ~ v26.7.8 (**12개**)     |

> 참고: 체인지로그에는 `v26.4.8` 섹션이 있지만 **해당 태그는 존재하지 않습니다**(미푸시). 그 내용은 `v26.5.0` 에 포함되어 있습니다.

### 실측 충돌 규모 (`git merge-tree --write-tree`, 워킹 트리 무영향)

| 병합 대상         | origin/master 기준 충돌 파일 수 |
| ----------------- | ------------------------------- |
| v26.5.0           | **28**                          |
| v26.6.0           | 34                              |
| v26.6.1           | 53                              |
| v26.7.0           | 55                              |
| v26.7.1 / v26.7.2 | 55                              |
| v26.7.3           | 69                              |
| v26.7.4 / v26.7.5 | 69                              |
| v26.7.6 / v26.7.7 | 74                              |
| v26.7.8           | **73**                          |

한 번에 v26.7.8까지 가면 73개 파일에서 충돌합니다. 첫 단계인 v26.5.0으로 끊으면 28개로 줄고, 그중 절반 이상은 기계적 처리 대상입니다.

**v26.5.0 충돌 파일 28개 분류**

- _기계적 (16)_: `CHANGELOG.md`, `package.json`(버전), `yarn.lock`(재생성), `.mergify.yml`, `.github/workflows/build.yml`, `docs/src/sl/index.md`, `release-notes/ko.md`, `src/i18n/{cmn-hans,fi,hu,ko,pt-pt,pt}.json`, `scripts/update-jw-icons-fallbacks.mjs`, `src-electron/preload/converters.ts`, `src/utils/converters.ts`
- _실질 검토 필요 (12)_: `src/helpers/jw-media.ts`, `src/pages/MediaCalendarPage.vue`, `src/pages/MediaPlayerPage.vue`, `src/layouts/MainLayout.vue`, `src/helpers/mediaPlayback.ts`, `src/helpers/electron-api-manager.ts`, `src/stores/jw.ts`, `src/migrations/index.ts`, `src/components/dialog/{DialogTimerPopup,DialogDisplayPopup,DialogDownloadsPopup,DialogBackgroundMusicPopup}.vue`

i18n JSON은 Crowdin 관리 방침(`37d25264a`)에 따라 **`ko.json` 외에는 업스트림 버전을 채택**하면 됩니다.

### 충돌 위험이 가장 큰 파일 (업스트림 변경량 순)

| 파일                                         | 업스트림 +/-  | 비고                                        |
| -------------------------------------------- | ------------- | ------------------------------------------- |
| `src/helpers/jw-media.ts`                    | +3931 / -1512 | 포크 커스터마이즈 핵심부와 정면 충돌        |
| `src/pages/MediaCalendarPage.vue`            | +2267 / -1353 | 동일                                        |
| `src/layouts/MainLayout.vue`                 | +1323 / -953  |                                             |
| `src/components/media/MediaItem.vue`         | +1429 / -382  |                                             |
| `src-electron/main/fs.ts`                    | +1281 / -238  |                                             |
| `src/components/dialog/DialogTimerPopup.vue` | +556 / -476   | 포크의 타이머 UI 추가분과 충돌              |
| `src/pages/MediaPlayerPage.vue`              | +600 / -272   | 포크의 yeartext 폰트/talk title 변경과 충돌 |
| `src/helpers/mediaPlayback.ts`               | +1 / -550     | 업스트림에서 사실상 제거/이동됨             |

> 포크의 커스터마이즈(연구절 CJK 폰트, pinyin 토글, pre-meeting clock, talk title 카드, Bethel speaker, playback speed, 한국어 i18n)가 **정확히 업스트림 변경이 집중된 파일들에 몰려 있습니다.** 단순 merge는 대량 충돌이 확실합니다.

## 2. 빠르게 반영해야 할 업데이트 (우선순위별)

### 🔴 P0 — 보안 (지연 없이 반영 권장)

| 커밋        | 날짜       | 내용                                                                                                                                     |
| ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `f13ed6f7f` | 2026-07-20 | **SQL 인젝션 차단** — `docId`, songbook pub, 테이블명을 파라미터화                                                                       |
| `2ee07f4bd` | 2026-07-04 | **Electron 신뢰 경계 / IPC / 시크릿 저장 하드닝**                                                                                        |
| (v26.7.3)   | 2026-07    | **zip-slip 경로 탈출 취약점** 수정 (JWPUB/zip 추출), 안전하지 않은 CSP 지시자 제거, preload API 표면 축소, OBS WebSocket 비밀번호 암호화 |
| `835da782c` | 2026-07-17 | Sentry DSN을 소스에서 빌드 타임 시크릿으로 이동                                                                                          |
| `bf2bc3297` | 2026-06-01 | 프로필 파일명 새니타이즈 하드닝 (#7688)                                                                                                  |
| `2ca62199f` | 2026-07-07 | `icongenie` → `sharp`/`png2icons` 교체로 **취약한 전이 의존성 제거**                                                                     |
| `d5687d71d` | 2026-05-07 | ReDoS 유발 가능 정규식 패턴 정리 (#7408, #7409)                                                                                          |

> **SQL 인젝션과 zip-slip은 이 앱이 외부에서 받은 `.jwpub`/`.jwlplaylist` 파일을 파싱한다는 점에서 실질적 공격 표면입니다.** 포크에도 동일 코드가 그대로 남아 있을 가능성이 높으므로 최우선 확인 대상입니다.

### 🟠 P1 — 안정성 / 크래시 (사용 중 체감되는 문제)

- **GPU 크래시 복구**: 세션 내 2회째 GPU 크래시 시 하드웨어 가속을 끈 상태로 선제 재실행 (`a251d6f90`, `03814dc4b`, `ba3118aca`). 이전에는 Chromium이 강제 종료할 때까지 방치.
- **다운로드/캐시 폴백**: 다운로드 폴더나 커스텀 캐시 폴더가 쓸 수 없게 되면 임시 저장소로 폴백 (`aad42344e`, `3875ede8a`).
- **캐시 자동 삭제 레이스**: 스마트 캐시 삭제가 백그라운드 미디어 페치와 경합해 **미래 날짜 미디어나 수동 추가 미디어를 삭제하던 버그** 수정 (v26.7.4).
- **손상 데이터 방어**: 깨진 `.last-used` 마커, 손상된 `jw-icons` 폰트 복구 (`3e3df6b38`, `ed6b77c3a`).
- **Windows 파일 락 재시도**: Dropbox 등이 잠근 파일에 대한 감시 폴더 쓰기 재시도 (v26.7.8) — Windows 사용자에게 직접적.
- **`Date` 객체 손상**: 내부 호출 간 `Date`가 `{}` 로 붕괴되어 **하루치 미디어가 오늘로 몰리는** 버그 수정 (v26.7.7).

### 🟡 P2 — 포크 유지보수 부담을 줄여주는 변경

- **`better-sqlite3` 제거 → Node 내장 SQLite 사용** (v26.7.0, `36a069bfb` 계열).
  → 네이티브 모듈이 하나 줄어들어 Windows/macOS 로컬 빌드가 크게 쉬워집니다. 현재 로컬 빌드가 막힌 원인도 네이티브 모듈 리빌드입니다(아래 4절 참조).
- **`@quasar/app-vite` 3.0.0 업그레이드** (v26.7.3) — 포크는 2.x. 미룰수록 마이그레이션 비용 증가.
- **`sanitize-filename` 내부 헬퍼로 교체** (`934be6216`) — 포크는 아직 외부 의존성 사용 중.
- **폰트 URL 동적 해석** (v26.7.7) — 하드코딩·버전 고정 경로가 만료되던 문제. **포크가 yeartext 폰트를 CDN에서 동적 로딩하도록 이미 자체 구현했으므로**(`0b38220e2` — `refactor: switch yeartext fonts from @fontsource bundle to jsDelivr CDN with local caching`) 업스트림 구현과 비교/통합 검토 필요.

### 🟢 P3 — 새 기능 (필요에 따라 선택)

| 버전    | 기능                                                                                  |
| ------- | ------------------------------------------------------------------------------------- |
| v26.7.7 | 미디어 프리뷰 화질 개선(canvas 고품질 다운스케일)                                     |
| v26.7.6 | CBS 영상 제외 설정, 문서 페이지 번호 표시                                             |
| v26.7.4 | **누락 미디어 복구** — 파일이 사라진 항목에 "파일 찾기" 액션                          |
| v26.7.0 | **연결 오디오 재생**(영상 슬라이드쇼 + 별도 음악), 감시 폴더 레이아웃 영속화          |
| v26.6.1 | **라이브 미디어 프리뷰 오버레이**, 미디어 검색(Ctrl+F), 설정 필터, 배경음악 중복 경고 |
| v26.6.0 | 타이머 아날로그 표시, **프로필 설정 가져오기/내보내기**, 재생 후 미디어 창 자동 숨김  |
| v26.5.0 | **PDF 가져오기**(발행물 PDF를 이미지로 분해), 다운로드 팝업 개선                      |
| v26.4.8 | JW Stream 미러링 지원, 네트워크 폴더 문제 알림                                        |

> 참고: v26.4.8의 "네트워크 폴더 문제 알림"과 "Memorial 과거 날짜 방지"는 **포크가 이미 자체적으로 구현했습니다**(`d74524d5c`, `c7c577fda`, `da1388911`, `35eeb468a`). 병합 시 중복 구현 충돌이 발생할 지점입니다.

## 3. 권장 동기화 전략

89% 파일 중복 + 4개월 갭 상황에서 `git merge upstream/master` 한 방은 현실적으로 관리 불가합니다.

### 권장: 3단계 분할 접근

1. **1단계 — 보안 패치 이식 ✅ 완료** (브랜치 `security/upstream-p0`, 커밋 `6c81d4306`)

   체리픽은 대부분 실패했고 **수동 이식**이 필요했습니다. 실제 적용 내역:

   | 항목                                     | 출처               | 상태                                                               |
   | ---------------------------------------- | ------------------ | ------------------------------------------------------------------ |
   | SQL 인젝션 파라미터화                    | `f13ed6f7f`        | ✅ 적용 (+ 업스트림이 놓친 `DocumentExtract` 조회도 함께)          |
   | Zip Slip 경로 탈출                       | `2ee07f4bd` 일부   | ✅ 적용 (에러 전파 방식을 포크 구조에 맞게 변경)                   |
   | 신뢰 도메인 `.` 경계 검사                | `2ee07f4bd` 일부   | ✅ 적용                                                            |
   | 프로필 파일명 새니타이즈                 | `bf2bc3297`        | ❌ 해당 없음 — `src/utils/profile-settings.ts` 가 포크에 없음      |
   | CSP / preload 축소 / OBS 비밀번호 암호화 | `2ee07f4bd` 나머지 | ⏳ 릴리스 병합으로 처리 (@quasar/app-vite 3.0 preload 재구성 의존) |
   | ReDoS 정규식                             | `d5687d71d`        | ⏳ 대부분 CI 워크플로. 실질 2줄, 병합 시 자연 반영                 |
   | Sentry DSN 시크릿화                      | `835da782c`        | 🔽 취약점 아님(DSN은 준공개), 포크 CI 커스터마이즈와 충돌          |

   테스트 추가: `src-electron/main/__tests__/fs.zip-slip.test.ts`(신규), `utils.test.ts`(도메인 경계 케이스) — 22개 통과.

   ⚠️ **미이식 항목 중 CSP `unsafe-inline`/`unsafe-eval` 제거와 preload API 축소는 실질적인 하드닝입니다.** 릴리스 병합이 늦어질 경우 별도 이식을 검토하세요.

2. **2단계 — 릴리스 단위 순차 병합 (계획 수립 후)**
   `v26.4.8` → `v26.5.0` → `v26.6.0` → ... 순으로 태그 단위 병합. 한 번에 4개월을 넘기지 말고 릴리스마다 빌드·수동 검증. 포크에 이미 `.claude/commands/merge-upstream` 슬래시 커맨드가 있습니다(`5ed2e293d docs: add merge-upstream slash command for upstream sync strategy`) — 그 전략을 먼저 확인할 것.

   **파일별 병합 전략** — 포크 변경량 대비 업스트림 변경량을 실측하면 대부분은 "업스트림 버전을 취하고 포크의 작은 델타를 재적용"이 최적입니다.

   | 파일                                                   | 포크 +/- | 업스트림 +/- | 전략                                                                           |
   | ------------------------------------------------------ | -------- | ------------ | ------------------------------------------------------------------------------ |
   | `src/helpers/electron-api-manager.ts`                  | 4/4      | 2/2          | 수동, 사소                                                                     |
   | `src/migrations/index.ts`                              | 4/0      | 5/0          | 양쪽 병합 (마이그레이션 등록 추가)                                             |
   | `src/components/dialog/DialogDisplayPopup.vue`         | 4/3      | 430/342      | **업스트림 채택 + 델타 재적용**                                                |
   | `src/components/dialog/DialogDownloadsPopup.vue`       | 2/4      | 509/310      | **업스트림 채택 + 델타 재적용**                                                |
   | `src/helpers/mediaPlayback.ts`                         | 10/3     | 1/550        | ⚠️ 업스트림이 550줄 제거(로직 이동). 포크 10줄을 **이동된 위치에 재구현** 필요 |
   | `src/components/dialog/DialogBackgroundMusicPopup.vue` | 23/22    | 616/169      | 업스트림 채택 + 델타 재적용                                                    |
   | `src/stores/jw.ts`                                     | 45/2     | 63/116       | 수동 병합                                                                      |
   | `src/pages/MediaCalendarPage.vue`                      | 59/15    | 2267/1353    | 업스트림 채택 + 델타 재적용                                                    |
   | `src/components/dialog/DialogTimerPopup.vue`           | 91/119   | 556/476      | 🔴 **어려움** — 포크 타이머 UI                                                 |
   | `src/pages/MediaPlayerPage.vue`                        | 219/49   | 600/272      | 🔴 **어려움** — yeartext 폰트, talk title, playback speed                      |
   | `src/helpers/jw-media.ts`                              | 231/99   | 3931/1512    | 🔴 **어려움** — pinyin, Bethel speaker, Memorial 로직                          |
   | `src/layouts/MainLayout.vue`                           | 248/33   | 1323/953     | 🔴 **어려움** — pre-meeting clock, 배너                                        |

   실질 난이도는 상단 4개 파일(🔴)에 집중되어 있습니다. 이 4개가 포크의 정체성입니다.

3. **3단계 — 포크 커스터마이즈 재정리**
   병합 비용의 근원은 포크 변경이 업스트림 핫스팟 파일 내부에 직접 박혀 있다는 점입니다. 재발 방지책:
   - 커스터마이즈를 별도 컴포저블/헬퍼 파일로 분리하고 호출 지점만 최소 삽입
   - 포크 전용 설정은 `constants/` 의 독립 파일로
   - i18n은 이미 "Crowdin이 관리하므로 비영어 파일은 업스트림으로 되돌린다"는 방침이 있음(`37d25264a`) — 유지

## 🔖 먼저 활용할 자산 — 소스에 이미 박혀 있는 `FORK-MERGE` 마커

병합을 시작하기 전에 반드시 확인하세요. 코드베이스에 **19곳**의 `FORK-MERGE` 주석이 있고, 단순히 "포크 전용"이라고만 표시하는 것이 아니라 **어느 쪽을 취해야 하는지까지** 기록되어 있습니다.

```powershell
git grep -n "FORK-MERGE" -- src src-electron
```

세 가지 유형이 있습니다.

| 유형           | 예                                                                       | 처리           |
| -------------- | ------------------------------------------------------------------------ | -------------- |
| 포크 전용 유지 | `src/pages/MediaPlayerPage.vue:23` — pre-meeting announcement banner     | 포크 블록 유지 |
| 업스트림 채택  | `src/stores/jw.ts:684` — 업스트림이 WOL URL로 변경(더 안정적)            | 업스트림 유지  |
| 양쪽 통합      | `src/stores/jw.ts:711` — 업스트림 인라인 CSS 파싱 + 포크 언어별 override | 둘 다 유지     |

주요 위치: `MediaPlayerPage.vue`(23, 41, 1019), `MainLayout.vue`(1200), `stores/jw.ts`(96, 684, 711, 739, 779, 815, 824, 909), `MediaItem.vue`(479, 869, 883, 1698, 1706), `constants/settings.ts`(773), `types/settings.d.ts`(227).

이 마커들이 위 "실질 검토 필요" 4개 파일에 집중되어 있으므로, 병합 난이도는 예상보다 낮을 수 있습니다. **마커를 먼저 읽고 그 판단을 따르세요.**

> 실제 도움이 된 예: `MediaItem.vue:883` 이 "업스트림이 별도 리셋 메뉴 항목 제거(속도 숫자 클릭으로 리셋)"라고 기록해 둔 덕분에, `reset-playback-speed` 번역 키가 왜 미사용이 되었는지 확인하고 안전하게 제거할 수 있었습니다.

## ⚠️ 병합할 때마다 반복될 함정 — 한국어/중국어 로케일이 조용히 사라진다

v26.5.0 병합 중 실제로 발생했습니다. **충돌로 잡히지 않아 놓치기 쉽습니다.**

업스트림은 `fc1001a6f` 에서 Crowdin 번역률 미달 로케일을 삭제했습니다. 여기에 **`ko.json` 과 `cmn-hans.json` 이 포함**됩니다 — 정확히 이 포크의 대상 언어입니다.

문제는 삭제 자체가 아니라 **등록 파일이 충돌 없이 자동 병합**된다는 점입니다:

- `src/i18n/index.ts` — `import ko from './ko.json'` 와 export 항목이 사라짐
- `src/constants/locales.ts` — `LanguageValue` 유니온, `enabled` 배열, `locales` 배열에서 `ko`/`cmnHans` 항목이 사라짐

`ko.json` 파일 자체는 modify/delete 충돌로 잡히지만, 그것만 살려도 **등록이 없으면 앱에서 한국어가 선택 불가**해집니다. 병합 후 반드시 확인하세요:

```powershell
Select-String -Path src/i18n/index.ts src/constants/locales.ts -Pattern "ko|cmnHans"
```

반대로 `fi`/`hu`/`it`/`pt-pt`/`sv`/`sw`/`tl` 는 **업스트림의 삭제를 수용하는 것이 맞습니다** — 포크가 `37d25264a fix: revert non-English i18n files to upstream (Crowdin handles translations)` 로 비영어 로케일을 업스트림에 위임하기로 정했기 때문입니다. 손으로 번역하는 `ko`/`cmn-hans` 만 예외입니다.

## v26.5.0 병합 진행 상황 (브랜치 `sync/upstream-v26.5.0`)

`git merge v26.5.0 --no-commit --no-ff` → 28개 충돌. 아래는 해소한 항목과 판단 근거입니다.

### 해소 완료 (13)

| 파일                                                            | 결정                                        | 근거                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/ko.json`, `cmn-hans.json`                             | **ours 유지**                               | 포크가 손으로 번역하는 대상 언어                                                                                                       |
| `src/i18n/index.ts`, `src/constants/locales.ts`                 | upstream + ko/cmnHans 재등록                | 위 함정 참조                                                                                                                           |
| `src/i18n/fi.json`, `hu.json`, `pt-pt.json`                     | **삭제 수용**                               | Crowdin 위임 방침                                                                                                                      |
| `src/i18n/pt.json`                                              | theirs                                      | 동일                                                                                                                                   |
| `src/helpers/electron-api-manager.ts`                           | **ours**                                    | 포크가 `@ts-expect-error` 를 `as ElectronApi` 캐스트로 개선했음. 업스트림보다 나음                                                     |
| `src/migrations/index.ts`                                       | **ours**                                    | 포크 전용 마이그레이션 `26.3.1-custom.0 removeLegacyJwIconsFont` 보존                                                                  |
| `src-electron/preload/converters.ts`, `src/utils/converters.ts` | **theirs**                                  | v26.5.0이 PDF 변환을 preload → 렌더러(`pdf-parse`)로 이동. `electron-preload.ts`/`electron.d.ts` 도 같은 방향으로 자동 병합되어 일관됨 |
| `docs/src/sl/index.md`                                          | theirs                                      | 업스트림 문서                                                                                                                          |
| `release-notes/ko.md`                                           | **ours**                                    | 포크 전용 릴리스 노트                                                                                                                  |
| `yarn.lock`                                                     | theirs (이후 `yarn install` 로 재생성 필요) |                                                                                                                                        |

### 미해소 (15)

- _설정/메타 (5)_: `.github/workflows/build.yml`, `.mergify.yml`, `CHANGELOG.md`, `package.json`(버전은 포크 값 유지), `scripts/update-jw-icons-fallbacks.mjs`(add/add — 양쪽이 각자 추가)
- _코드 — 비교적 단순 (6)_: `src/stores/jw.ts`, `src/pages/MediaCalendarPage.vue`, `src/components/dialog/{DialogDisplayPopup,DialogDownloadsPopup,DialogBackgroundMusicPopup}.vue`, `src/helpers/mediaPlayback.ts`
- _코드 — 포크 정체성, 신중히 (4)_: `src/helpers/jw-media.ts`, `src/layouts/MainLayout.vue`, `src/pages/MediaPlayerPage.vue`, `src/components/dialog/DialogTimerPopup.vue`

### 확인된 사실 — 조용한 손실은 i18n 외에 없었음

포크가 수정한 90개 파일 중 자동 병합된 것들을 `git diff HEAD --numstat` 으로 검사한 결과, 포크 기능이 사라진 파일은 없었습니다. `MediaItem.vue` 가 68줄 삭제/68줄 추가로 크게 변했지만 업스트림의 코드 재배치이며 포크의 playback speed 관련 코드는 그대로 유지됩니다.

### 되돌리려면

```sh
git merge --abort      # 병합 전체 취소
git checkout security/upstream-p0
```

### 병합 전 필수 확인

- [ ] `.claude/commands/merge-upstream` 의 기존 전략 확인
- [ ] 포크 전용 CI 워크플로(`custom-build`)가 업스트림 워크플로 변경과 충돌하지 않는지
- [ ] `appId` 포크 전용 값(`c46868a54`)이 병합 중 되돌려지지 않도록 주의
- [ ] `@sentry/electron` yarn 패치(포크 CLAUDE.md 언급)가 업스트림 의존성 변경 후에도 적용되는지
- [ ] v26.7.0의 `better-sqlite3` 제거가 포크의 DB 관련 커스터마이즈와 충돌하지 않는지

## 4. 관련 미해결 이슈

- **수동 추가 영상 자막 미표시 버그**: 업스트림에 수정 없음 → 자체 구현 필요. [todo/manual-media-subtitles.md](./manual-media-subtitles.md) 참조.
- **Windows 로컬 빌드 차단**: `@jitsi/robotjs` 네이티브 리빌드에 Python + Visual Studio C++ 빌드 도구 필요. 업스트림 브랜치 `upstream/codex/test-robotjs-prebuilds` 가 robotjs prebuild 사용을 실험 중이므로 주시할 가치가 있습니다.

## 5. 재현 명령

```sh
git remote add upstream https://github.com/sircharlo/meeting-media-manager.git
git fetch upstream --tags
MB=$(git merge-base origin/master upstream/master)
git rev-list --left-right --count origin/master...upstream/master
git log --no-merges --oneline "$MB..upstream/master"
git show upstream/master:CHANGELOG.md
```
