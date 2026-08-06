# TODO: 미디어 창에 연표어가 표시되지 않음

- **상태**: **기존 버그로 확정** (제 변경과 무관). 최초 설정 직후 발생하고 **앱 재시작으로 해소**됩니다. 메커니즘 미규명, 코드 수정 없음
- **작성일**: 2026-08-06 / **최종 갱신**: 2026-08-06 (사용자 A/B 실험 후)
- **환경**: 중국어 간체(`CHS`) 설정 회중

## 결론: 제 회귀가 아닙니다 (사용자 A/B 실험)

사용자가 직접 확인해 주었습니다:

| 설치                                | 설정 방법                       | 연표어                       |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| **custom.0** (제 변경 이전 기준선)  | 회중 검색 불가 → 언어 수동 선택 | **안 나옴**                  |
| custom.0 → 종료 후 재실행           | —                               | (아래 custom.5 와 동일 패턴) |
| **custom.5** 완전 삭제 후 신규 설치 | 회중 검색으로 설정              | **안 나옴**                  |
| custom.5 → 종료 후 재실행           | —                               | **나옴**                     |

**`custom.0` 에서도 재현되므로 이 버그는 제가 만든 것이 아니고, 회중 검색 이식과도 무관합니다.** 최초 설정 절차 자체에 있는 문제입니다.

이것으로 초기 진단의 남은 부분도 정리됩니다 — 연표어는 언어 덮어쓰기(custom.4 수정)나 요일 밀림(custom.5 수정)과 인과가 없습니다. 같은 시기에 함께 보고되었을 뿐입니다.

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

**결론**: 영속 데이터와 렌더 경로에는 결함이 없습니다. 증상은 **실행 중인 세션의 휘발성 상태** 문제이며 **앱을 완전히 종료하고 다시 실행하면 해소**됩니다.

## 메커니즘은 규명되지 않았습니다

**재시작하면 해소된다**는 것만 확인했습니다. 왜 실행 중이던 세션에서 표시되지 않았는지는 모릅니다.

세운 가설이 전부 반증되었습니다:

- **`yeartextWatcherPaused` 래치** — 아래 참고. 이 결함은 실재하지만 **이번 사례에는 적용되지 않습니다.** 래치는 공개강연 제목 카드가 표시 중에 언마운트될 때만 걸리는데, 해당 프로필의 `enablePublicTalkTitle` 이 `false` 여서 **카드가 애초에 존재하지 않았습니다.** 표시한 적이 없으니 래치도 걸릴 수 없습니다.
- **스토어에 CHS 연표어 없음** — 반증. `yeartexts[2026]` 에 `E` 와 `CHS`(169자) 모두 있습니다.
- **아래 표의 6가지 후보** — 전부 반증.

남은 가능성 중 검증하지 못한 것: 언어를 되돌린 직후 `updateYeartext` 의 네트워크 조회가 완료되기까지의 **타이밍**, 그리고 이미 열려 있던 미디어 창이 `postYeartext` 를 다시 받았는지. 재현하려면 언어가 잘못된 상태에서 시작해 실시간으로 되돌려야 하므로 사용자 설정을 다시 건드려야 합니다.

**따라서 코드 수정은 하지 않았습니다.** 원인을 모르는 상태에서 고치면 어제와 같은 회귀를 만듭니다.

## 조사에서 틀렸던 것들

이 문서가 남는 주된 이유입니다.

1. **래치 가설을 세웠다가 폐기하고, 실측 후 다시 채택했다가, 최종적으로 반증되었습니다.** 세 번 뒤집혔습니다.
2. **요일 버그가 카드를 없앴다고 확정한 것처럼 서술했습니다.** 요일 버그는 실측으로 확정됐지만 카드와의 연결은 검증한 적이 없고, 실제 원인은 `enablePublicTalkTitle: false` 였습니다. **사용자가 직접 지적해 바로잡았습니다.**
3. **KST 함정으로 요일 인과를 한 번 오판했습니다** (아래).

공통 원인은 **정적 분석으로 인과를 확정하려 한 것**입니다. 실측한 사실(요일 값이 밀렸다, 연표어가 새 실행에서 표시된다)은 맞았고, 그 사실들을 이어붙인 추론이 틀렸습니다.

## 별개로 존재하는 결함 — `yeartextWatcherPaused` 고정 (이번 증상의 원인은 아님)

**이 절은 이번 증상과 무관합니다.** 조사 중 원인으로 의심했다가 반증되었고, 그 과정에서 발견한 별개의 결함이므로 남겨 둡니다.

[`MainLayout.vue`](../src/layouts/MainLayout.vue) 의 `handlePublicTalkTitle` 은 제목 표시 중 `yeartextWatcherPaused = true` 로 연표어 워처를 멈추고, `html: null` 이벤트에서만 재개합니다. [`PublicTalkTitleCard.vue`](../src/components/media/PublicTalkTitleCard.vue) 의 `onBeforeUnmount` 는 리스너만 제거하고 `stopTitleDisplay()` 를 호출하지 않으므로, 카드가 **표시 중에 언마운트되면 그 플래그가 고정**됩니다.

`yeartextWatcherPaused` 는 **영속되지 않는 `ref`** 이므로 재시작하면 `false` 로 돌아갑니다. 따라서 이 결함은 실행 중인 세션에서만 증상을 만듭니다.

### 시도했다가 되돌린 수정 — 부작용이 더 컸음

`onBeforeUnmount` 에서 `stopTitleDisplay()` 를 호출하는 방식을 구현했다가 커밋 전 리뷰에서 되돌렸습니다. 사회자가 공개강연 제목을 프로젝터에 띄운 상태로 설정 페이지를 열면 라우트 변경 → `MediaCalendarPage` → `MediaList` → 카드 언마운트 → **프로젝터 화면이 지워집니다.** 고치려던 것보다 나쁩니다.

올바른 수정은 "섹션이 사라져서 언마운트"와 "화면 이동으로 언마운트"를 구분하는 것인데, 컴포넌트 내부에서는 판단할 수 없습니다. **`MainLayout` 쪽에서 boolean 래치 대신 제목 상태(`talkTitleHtml`)를 보유하고 `talkTitleHtml ?? yeartext` 를 post 하는 형태**로 바꾸는 것이 옳습니다. 소유자가 명확해지고 고아 상태가 생기지 않습니다. **별도 작업으로 분리합니다.**

## 배제한 원인들 (근거 포함)

| 후보                                 | 결과 | 근거                                                                                                                                        |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CHS 연표어를 서버가 주지 않음        | ❌   | `wol.jw.org/wol/finder?docid=1102026800&wtlocale=CHS` 실호출 → 196자 중국어 정상 반환 (E/KO/CHM 도 정상)                                    |
| `lang` 이 아직 영어                  | ❌   | 프로필 사본의 설정을 직접 읽어 `lang: 'CHS'` 확인. 미디어 창도 중국어 연표어를 렌더                                                         |
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

**KST 함정.** `lookupPeriod` 의 `date` 는 `2026-08-02T15:00:00.000Z` 형태(= KST 자정)입니다. `slice(0,10)` 으로 요일을 계산하면 **하루 이르게** 나와, 잘못된 요일 배치가 정상처럼 보입니다. 이 때문에 조사 중 "요일 버그가 섹션에 영향을 주지 않는다"고 한 번 오판했고, 날짜 선택기 스크린샷(집회 점이 월·금 열에만 찍힘)을 보고 바로잡았습니다. `new Date(d.date)` 로 로컬 해석하십시오.

### 주목할 만한 구조적 문제

[`stores/jw.ts:632`](../src/stores/jw.ts#L632) `updateYeartext` 의 호출 경로는 **4곳뿐**입니다:

- `MainLayout.vue:442` — `watch(online)`, **immediate 아님** (온라인 전환 시에만)
- `CongregationSelectorPage.vue:182`
- `SettingsPage.vue:323` — `watch([lang, langFallback])`, immediate 아님
- `SetupWizard.vue:703`

**회중이 이미 선택된 상태로 앱을 시작하고 계속 온라인이면 어느 것도 발동하지 않습니다.** 연표어는 영속 스토어에 이미 있는 값에만 의존합니다.

또한 [`current-state.ts`](../src/stores/current-state.ts) 의 게터는 설정된 언어만 봅니다:

```js
return textsForYear[lang] || (langFallback && textsForYear[langFallback]);
```

`updateYeartext` 는 **항상 `E` 도 함께 받아오는데**(`langs = new Set(['E', lang])`) 게터는 `langFallback` 이 명시적으로 설정되지 않으면 영어로 폴백하지 않습니다. 확인한 프로필의 `langFallback` 은 `null` 이었습니다. 그래서 `yeartexts[2026].E` 가 있어도 `CHS` 가 아직 없으면 **화면이 빈 상태**가 됩니다.

최초 설정 시나리오에서 이것이 실제로 발동하는지는 확인하지 못했습니다. 다음 조사 때 여기서 시작하는 것이 합리적입니다.

## 다음 조사자를 위한 재현 조건

사용자 A/B 실험으로 확보된, **사용자 프로필이 필요 없는** 재현 절차:

1. 앱을 완전히 삭제(또는 빈 `--user-data-dir` 로 실행)
2. 초기 설정 마법사를 끝까지 진행하며 미디어 언어를 중국어 간체로 지정
3. 설정 완료 직후 미디어 창을 확인 → **연표어 없음**
4. 앱을 완전히 종료하고 재실행 → **연표어 표시됨**

마법사를 CDP 로 자동 진행하려 했으나 폴더 선택이 네이티브 대화상자를 띄워 막혔습니다. 수동으로 마법사를 진행한 뒤 CDP 로 관찰하는 방식이 현실적입니다(위 절차 참고). 프로덕션 빌드에는 Vue devtools 훅이 없어 Pinia 스토어에 직접 접근할 수 없으므로, 상태는 `localStorage` 의 `jw-store` / `congregation-settings` 를 읽어 확인하십시오.

## 관련 문서

- [congregation-lookup-broken.md](./congregation-lookup-broken.md) — 같은 시기 함께 보고된 요일 밀림(수정 완료)
- [pinyin-toggle-unreachable.md](./pinyin-toggle-unreachable.md) — 같은 A/B 실험에서 밝혀진 병음 토글 문제(수정 완료)
- [local-build-and-test-status.md](./local-build-and-test-status.md) — 로컬 빌드/실행 환경
