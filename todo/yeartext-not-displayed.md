# TODO: 미디어 창에 연표어가 표시되지 않음

- **상태**: **앱 재시작으로 해결됨.** 데이터·렌더 경로 모두 정상임을 실측 확인. 코드 수정은 하지 않았습니다
- **작성일**: 2026-08-06 / **최종 갱신**: 2026-08-06 (실측 검증 후)
- **보고**: v26.4.7-custom.2~4 사용 중 사용자 보고. 병음 토글은 custom.4 + 언어 복원으로 회복되었으나 연표어는 여전히 미표시
- **환경**: 중국어 간체(`CHS`) 설정 회중

## 실측 검증 결과 (2026-08-06)

사용자 프로필 **사본**으로 새 빌드를 실행하고 CDP로 미디어 창을 검사했습니다. **연표어가 정상 표시됩니다.**

```json
{
  "yeartextExists": true,
  "yeartextHTML": "<p class=\"themeScrp\"><strong>“渴望满足心灵需要的人有福了。”</strong></p>…",
  "yeartextOpacity": "1",
  "yeartextInlineStyle": "font-family: NotoSansSC, \"Microsoft YaHei\", …",
  "clockShown": false
}
```

스토어 상태도 정상입니다:

```json
{
  "yeartextYears": ["2026"],
  "yeartext2026Langs": ["E", "CHS"],
  "yeartext2026ChsLen": 169
}
```

`E` 항목이 언어가 영어로 덮어써졌던 기간의 흔적이고, `CHS` 는 사용자가 언어를 되돌렸을 때 받아온 것입니다.

**결론**: 영속 데이터와 렌더 경로에는 결함이 없습니다. 증상은 **실행 중인 세션의 휘발성 상태** 문제이며 **앱을 완전히 종료하고 다시 실행하면 해소**됩니다. 아래 폐기했던 래치 가설이 실은 이 세션 상태를 정확히 설명합니다 — 다만 재시작으로 풀리므로 사용자에게는 재시작이 답이고, 코드 수정은 별도 작업입니다.

## 왜 이 문서가 있는가

같은 보고에 함께 들어온 **공개강연 연제 카드 미표시는 원인을 규명해 수정했습니다**(요일 off-by-one, [congregation-lookup-broken.md](./congregation-lookup-broken.md) 회귀 3번). 처음에는 두 증상이 하나의 사슬이라고 판단했지만, 연표어 쪽은 그 설명이 성립하지 않습니다. 추측으로 고치지 않기 위해 분리했습니다.

## 남은 실제 결함 — `yeartextWatcherPaused` 고정 (별도 작업)

[`MainLayout.vue`](../src/layouts/MainLayout.vue) 의 `handlePublicTalkTitle` 은 제목 표시 중 `yeartextWatcherPaused = true` 로 연표어 워처를 멈추고, `html: null` 이벤트에서만 재개합니다. [`PublicTalkTitleCard.vue`](../src/components/media/PublicTalkTitleCard.vue) 의 `onBeforeUnmount` 는 리스너만 제거하고 `stopTitleDisplay()` 를 호출하지 않으므로, 카드가 **표시 중에 언마운트되면 그 플래그가 고정**됩니다. 요일 버그로 `pt` 섹션이 사라진 것이 정확히 그 언마운트를 일으킵니다.

`yeartextWatcherPaused` 는 **영속되지 않는 `ref`** 이므로 재시작하면 `false` 로 돌아가고 `watchImmediate(yeartext)` 가 다시 post 합니다. 그래서 이 결함은 **실행 중인 세션에서만** 증상을 만들고, 위 실측처럼 새로 띄우면 정상입니다.

### 시도했다가 되돌린 수정 — 부작용이 더 컸음

`onBeforeUnmount` 에서 `stopTitleDisplay()` 를 호출하는 방식을 구현했다가 커밋 전 리뷰에서 되돌렸습니다. 사회자가 공개강연 제목을 프로젝터에 띄운 상태로 설정 페이지를 열면 라우트 변경 → `MediaCalendarPage` → `MediaList` → 카드 언마운트 → **프로젝터 화면이 지워집니다.** 고치려던 것보다 나쁩니다.

올바른 수정은 "섹션이 사라져서 언마운트"와 "화면 이동으로 언마운트"를 구분하는 것인데, 컴포넌트 내부에서는 판단할 수 없습니다. **`MainLayout` 쪽에서 boolean 래치 대신 제목 상태(`talkTitleHtml`)를 보유하고 `talkTitleHtml ?? yeartext` 를 post 하는 형태**로 바꾸는 것이 옳습니다. 소유자가 명확해지고 고아 상태가 생기지 않습니다. **별도 작업으로 분리합니다.**

## 배제한 원인들 (근거 포함)

| 후보                                 | 결과 | 근거                                                                                                                                        |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CHS 연표어를 서버가 주지 않음        | ❌   | `wol.jw.org/wol/finder?docid=1102026800&wtlocale=CHS` 실호출 → 196자 중국어 정상 반환 (E/KO/CHM 도 정상)                                    |
| `lang` 이 아직 영어                  | ❌   | 병음 토글이 표시됨. 그 조건은 [`HeaderCalendar.vue:351`](../src/components/header/HeaderCalendar.vue#L351) 의 `lang === 'CHS'` 리터럴 비교  |
| 이번 작업의 CSS 변경                 | ❌   | 커밋 범위에 `MediaPlayerPage.vue` 변경 없음. `app.scss` 는 5줄(`.action-island-container` z-index)뿐                                        |
| 사전집회 시계가 가림                 | ❌   | `.base-layer.clock-active :deep(#preMeetingClockContainer)` 는 시계 위치만 지정. 연표어를 숨기는 규칙 없음                                  |
| `fontsSet` 이 false                  | ❌   | [`MediaPlayerPage.vue:1310`](../src/pages/MediaPlayerPage.vue#L1310) — 폰트 로드가 실패해도 무조건 `true`                                   |
| `mediaPlayerCustomBackground` 설정됨 | ❌   | 설정되면 base-layer 전체가 숨겨지지만, i18n `custom-background-will-not-persist` 대로 **앱 종료 시 사라짐**. 재시작 후 증상이 남으므로 불가 |

## 조사 방법 — 앱을 CDP로 검사하기

정적 분석만으로는 판정할 수 없었습니다. 이 절차가 통했으므로 기록합니다.

**함정: `ELECTRON_RUN_AS_NODE=1`.** 이 환경변수가 설정되어 있으면 Electron 바이너리가 **Node로 실행**되어 `--user-data-dir` 같은 Chromium 플래그를 `bad option:` 으로 거부합니다. 먼저 `Remove-Item Env:\ELECTRON_RUN_AS_NODE` 하십시오.

```powershell
# 1. 사용자 프로필을 사본으로 (원본 미변경). 설정은 Local Storage 의 LevelDB 안에 있음
foreach ($i in @('Local Storage','Cong Preferences','Session Storage','Local State','Preferences')) {
  Copy-Item "$env:APPDATA\Meeting Media Manager\$i" -Destination $dst -Recurse -Force
}
# 2. 실행
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process "dist\electron\Packaged\win-unpacked\Meeting Media Manager.exe" `
  -ArgumentList "--user-data-dir=`"$dst`"", "--remote-debugging-port=9333"
```

검사는 Node 24의 **내장 `WebSocket`** 으로 CDP `Runtime.evaluate` / `Page.captureScreenshot` 을 호출하면 됩니다 (PowerShell 5.1 에는 `ClientWebSocket` 이 없어 실패합니다). 타깃 목록은 `http://127.0.0.1:9333/json/list` — 창 두 개가 `Media Player - M³` / `집회 미디어 - M³` 제목으로 잡힙니다.

**localStorage 를 직접 패치하는 방식은 신뢰할 수 없습니다.** 실행 중인 앱이 종료 시 메모리 상태를 다시 써서 덮습니다. 설정을 바꿔 검증하려면 UI를 조작해야 합니다.

### 주목할 만한 구조적 문제

[`stores/jw.ts:632`](../src/stores/jw.ts#L632) `updateYeartext` 의 호출 경로는 **4곳뿐**입니다:

- `MainLayout.vue:442` — `watch(online)`, **immediate 아님** (온라인 전환 시에만)
- `CongregationSelectorPage.vue:182`
- `SettingsPage.vue:323` — `watch([lang, langFallback])`, immediate 아님
- `SetupWizard.vue:703`

**회중이 이미 선택된 상태로 앱을 시작하고 계속 온라인이면 어느 것도 발동하지 않습니다.** 연표어는 영속 스토어에 이미 있는 값에만 의존합니다. `yeartexts[2026][CHS]` 가 한 번도 채워지지 않았다면(언어가 영어로 바뀐 동안 `langs = Set(['E'])` 만 조회) 사용자가 설정에서 언어를 건드리거나 오프라인→온라인 전환이 일어날 때까지 계속 비어 있습니다.

이 경로라면 **설정에서 언어를 다른 값으로 바꾸고 다시 CHS로 되돌리면 복구**됩니다. 사용자에게 시켜볼 수 있는 가장 값싼 검증입니다.

## 관련 문서

- [congregation-lookup-broken.md](./congregation-lookup-broken.md) — 함께 보고된 공개강연 카드 문제(원인 규명·수정 완료)
- [local-build-and-test-status.md](./local-build-and-test-status.md) — 로컬 빌드/실행 환경
