# TODO: 영상 재생이 JW Library보다 무겁고 간헐적으로 버벅이는 문제

- **상태**: 코드 기반 가설 수립 완료 / **실측 미실시** / 미수정
- **작성일**: 2026-08-05
- **기준**: 포크 `86e81174a` + 보안 브랜치 (`security/upstream-p0`). 업스트림 `upstream/master`(2026-08-03)와 비교

> ⚠️ **아래는 전부 코드를 읽고 세운 가설입니다. 프로파일링으로 확인한 것이 아닙니다.** 2절의 실측을 먼저 하고, 그 결과에 따라 3절에서 원인을 좁히세요. 순서를 뒤집으면 엉뚱한 곳을 고치게 됩니다.

## 1. 증상

- JW Library로 같은 영상을 재생할 때보다 CPU 사용률이 높음
- 간헐적으로 버벅임(stutter) 발생

## 2. 먼저 실측할 것 (원인 추정보다 우선)

### 2.1 하드웨어 가속이 켜져 있는지 — 가장 먼저 확인

이것 하나로 증상이 전부 설명될 수 있습니다(3.1 참조).

```powershell
# 1) 플래그 파일이 존재하고 disabled=true 면 소프트웨어 디코딩 중
Get-Content "$env:APPDATA\Meeting Media Manager\hw-accel-disabled.json" -ErrorAction SilentlyContinue
Get-Content "$env:APPDATA\Meeting Media Manager\crash-count.json" -ErrorAction SilentlyContinue
```

앱 로그에서도 확인 가능합니다 — 시작 시 `Hardware acceleration disabled` 또는 `Hardware acceleration enabled` 를 기록합니다([electron-main.ts:180-182](../src-electron/electron-main.ts#L180-L182)).

> 실제 `userData` 경로는 `productName` 기준이며 포터블 빌드는 다릅니다([electron-main.ts:197-203](../src-electron/electron-main.ts#L197-L203)). 위 경로가 없으면 로그로 확인하세요.

### 2.2 디코딩이 GPU에서 일어나는지

개발자 도구가 열리는 빌드에서 `chrome://gpu` 상당 정보를 확인하거나, **Windows 작업 관리자 → 성능 → GPU** 에서 재생 중 `Video Decode` 그래프가 움직이는지 봅니다. 움직이지 않고 CPU만 오르면 소프트웨어 디코딩입니다.

### 2.3 어떤 프로세스가 CPU를 쓰는지 분리

작업 관리자에서 `Meeting Media Manager` 를 펼쳐 **GPU 프로세스 / 렌더러 프로세스 / 메인 프로세스** 중 어디가 높은지 봅니다.

- GPU 프로세스가 높다 → 디코딩/합성 문제 (3.1, 3.5)
- 렌더러가 높다 → JS 루프/리렌더 문제 (3.2, 3.3)

### 2.4 시간에 따라 악화되는지 — 3.2 가설의 결정적 판별

**앱을 새로 시작한 직후 영상 1개 재생**했을 때의 CPU와, **영상 여러 개를 순차 재생한 뒤 마지막 영상**의 CPU를 비교하세요.

- 뒤로 갈수록 무거워진다 → **3.2가 원인일 가능성이 매우 높습니다**
- 처음부터 균일하게 무겁다 → 3.1 또는 코덱/해상도 문제

### 2.5 코덱·해상도 확인

JW Library와 M³가 **같은 파일**을 재생하는지 확인하세요. M³는 JW.org에서 720p를 받는데 JW Library가 480p를 재생하고 있으면 비교 자체가 성립하지 않습니다. `mediainfo` 등으로 코덱(H.264 / VP9 / AV1)을 확인하세요 — **AV1은 하드웨어 디코딩 지원이 제한적이라 소프트웨어 디코딩으로 떨어지기 쉽습니다.**

## 3. 가설 (영향도 순)

### 3.1 🔴 하드웨어 가속이 영구적으로 꺼져 있을 가능성

[electron-main.ts:153-183](../src-electron/electron-main.ts#L153-L183), [387-453](../src-electron/electron-main.ts#L387-L453)

가속이 꺼지는 경로가 셋 있습니다.

| 경로                                       | 위치                                                  | `temporary` | 자동 복구             |
| ------------------------------------------ | ----------------------------------------------------- | ----------- | --------------------- |
| 시작 시 크래시 3회 누적                    | [158-170](../src-electron/electron-main.ts#L158-L170) | `true`      | ✅ 다음 실행에서 복구 |
| GPU 크래시 감지                            | [244-251](../src-electron/electron-main.ts#L244-L251) | `true`      | ✅ 다음 실행에서 복구 |
| **렌더러 IPC `set-hardware-acceleration`** | [428-430](../src-electron/electron-main.ts#L428-L430) | **`false`** | ❌ **영구**           |

`temporary: true` 인 경우는 다음 실행 시 [446-453](../src-electron/electron-main.ts#L446-L453) 의 `wasHwAccelTemporarilyDisabled()` 가 플래그를 되돌립니다. 하지만 **IPC 경로는 `temporary = false`** 로 기록되어 자동 복구 대상이 아닙니다.

즉 **과거에 GPU 크래시 알림을 보고 "하드웨어 가속 끄기"를 한 번 수락했다면, 그 이후 계속 소프트웨어 디코딩으로 재생**됩니다. CPU 상승과 버벅임이 동시에 설명되고, "가끔"인 이유(그 계기가 있었던 프로필에서만 발생)도 설명됩니다.

**할 일**

1. 2.1로 현재 상태 확인
2. 꺼져 있으면 `hw-accel-disabled.json` 삭제 후 재시작하여 증상이 사라지는지 확인
3. 사라지면 → 설정 UI에서 가속 상태를 **표시하고 되돌릴 수 있게** 만들 것. 현재 영구 비활성을 사용자가 알거나 되돌릴 방법이 UI에 없습니다
4. 크래시 원인 자체(왜 GPU가 죽었는지)는 별도 조사 — 업스트림이 v26.6.0~v26.7.8에서 GPU 크래시 진단·복구를 크게 보강했습니다(`ba3118aca`, `03814dc4b`, `a251d6f90`). 동기화 시 유입됩니다

### 3.2 🔴 재생마다 requestAnimationFrame 루프가 누적된다 (업스트림 버그)

[MediaPlayerPage.vue:652-722](../src/pages/MediaPlayerPage.vue#L652-L722)

`playMedia()` 는 호출될 때마다 **클로저 지역 변수** `rafId` 와 `updateTime` 루프를 새로 만듭니다.

```js
const playMedia = () => {
  let rafId = 0;                          // 호출마다 새 변수
  const updateTime = () => {
    if (isEnding.value) return;           // ← 유일한 정상 종료 조건
    ...
    if (mediaCustomDuration.value && customMax.value && currentTime >= customMax.value) {
      isEnding.value = true;
      endOrLoop();
      cancelAnimationFrame(rafId);        // ← 유일한 cancel, 커스텀 구간 재생에서만
      return;
    }
    rafId = requestAnimationFrame(updateTime);   // 무조건 재예약
  };
  currentMediaElement.value.ontimeupdate = () => {
    if (!rafId) rafId = requestAnimationFrame(updateTime);
  };
```

문제:

- `cancelAnimationFrame` 은 **커스텀 재생 구간(`customMax`)이 설정된 미디어**에서만 호출됩니다.
- `isEnding` 을 `true` 로 만드는 곳은 위 한 군데뿐입니다. `false` 로 되돌리는 곳은 두 군데([509](../src/pages/MediaPlayerPage.vue#L509), [857](../src/pages/MediaPlayerPage.vue#L857)).
- 따라서 **커스텀 구간이 없는 일반 영상은 루프 종료 경로가 없습니다.** 재생이 끝나도 rAF가 계속 자기 자신을 재예약합니다.
- [266행](../src/pages/MediaPlayerPage.vue#L266) `element.ontimeupdate = null` 은 핸들러만 떼고 **이미 돌고 있는 루프를 멈추지 않습니다.**
- 결과: 모임 중 영상을 N개 재생하면 **매 프레임 도는 루프가 N개까지 누적**됩니다. 각 루프는 300ms마다 `postCurrentTime()` 으로 BroadcastChannel 메시지를 보내므로, 메인 윈도우의 반응형 리렌더가 N배로 늘어납니다.

이것이 **"가끔"** 과 **"시간이 지나면 심해짐"** 을 설명합니다. 앱 재시작으로 일시적으로 나아진다면 이 가설이 유력합니다 → **2.4로 판별하세요.**

**업스트림도 동일합니다.** merge-base(`2738d7526`)에도 있고 `upstream/master` [762-806행](https://github.com/sircharlo/meeting-media-manager/blob/master/src/pages/MediaPlayerPage.vue)에도 같은 구조가 그대로 남아 있습니다 → **동기화로 해결되지 않습니다. 자체 수정 + 업스트림 PR 대상입니다.**

**수정 방향**

- `rafId` 를 컴포넌트 스코프(`ref`)로 올리고, `playMedia()` 진입 시 기존 루프를 `cancelAnimationFrame` 후 `rafId = 0` 으로 초기화
- 미디어 종료·전환·언마운트 시에도 취소 (`onUnmounted`, 미디어 변경 watch, `endOrLoop`)
- 애초에 매 프레임 돌 필요가 없습니다. 300ms 스로틀이 목적이라면 rAF 대신 `ontimeupdate`(브라우저가 초당 약 4회 발행) 안에서 직접 스로틀하면 프레임당 작업이 사라집니다. 커스텀 구간 종료 판정 정밀도만 확인하면 됩니다

### 3.3 🟠 포크가 추가한 1초 주기 인터벌

- [MainLayout.vue:1259](../src/layouts/MainLayout.vue#L1259) — `setInterval(checkPreMeetingFeatures, 1000)` (pre-meeting 배너/카운트다운)
- [MediaPlayerPage.vue:1076](../src/pages/MediaPlayerPage.vue#L1076) — `clockInterval` (pre-meeting 시계)

각각은 가볍지만 **재생 중에도 계속 돌면서 반응형 상태를 갱신**하면 리렌더를 유발합니다. 확인 후, 재생 중에는 정지시키거나 화면에 보일 때만 돌도록 조건을 거는 것이 좋습니다.

### 3.4 🟠 크로스페이드용 2중 video 레이어

[MediaPlayerPage.vue](../src/pages/MediaPlayerPage.vue) 는 `displayLayer1` / `displayLayer2` 두 개의 `<video>` 를 둡니다. 전환 시 이전 레이어의 `url` 을 `''` 로 비우는 경로가 있지만, **모든 전환 경로에서 확실히 비워지는지** 확인이 필요합니다. 비워지지 않으면 디코더 2개가 동시에 돕니다.

### 3.5 🟡 카메라 / 화면 캡처 스트림

[MediaPlayerPage.vue:1134-1139](../src/pages/MediaPlayerPage.vue#L1134-L1139) 의 `getUserMedia` / `getDisplayMedia`. 수어 회중용 카메라 배경이나 웹사이트 미러링을 쓰는 경우에만 해당하지만, 켜져 있으면 영상 재생과 별도로 상당한 비용이 듭니다. 해당 기능을 쓰지 않는데도 스트림이 살아 있는지 확인하세요.

### 3.6 🟡 확인 결과 원인이 아닌 것들

조사했지만 문제가 아니었습니다. 다시 파헤치지 마세요.

- **영상 위 고비용 CSS 없음** — `backdrop-filter`, `filter: blur`, `mix-blend-mode` 를 재생 화면에 쓰지 않습니다. `box-shadow` 는 [app.scss](../src/css/app.scss) 의 다이얼로그·버튼용입니다
- **매 프레임 canvas 그리기 없음** — `drawImage` 는 썸네일 추출([fs.ts:134](../src/helpers/fs.ts#L134))과 이미지 변환([converters.ts:42](../src/utils/converters.ts#L42))에서만 1회성으로 쓰입니다. (참고: 업스트림 v26.7.7이 도입한 canvas 기반 미디어 프리뷰는 포크에 없습니다 — 동기화 시 새 비용이 생길 수 있습니다)

### 3.7 🟢 구조적으로 불가피한 차이

M³는 Electron/Chromium, JW Library는 네이티브 앱입니다. 동일 조건에서도 M³가 더 무거운 것은 정상이며, **완전히 동등해지지는 않습니다.** 목표는 "JW Library와 같게"가 아니라 "버벅임 없이 재생"으로 잡는 것이 현실적입니다.

## 4. 관련 업스트림 작업

| 버전             | 내용                                                                                             | 이 문제와의 관계                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| v26.7.8          | GPU-fatal 크래시 감지가 잘못된 Sentry 컨텍스트를 읽던 버그 수정, 2회째 GPU 크래시 시 선제 재실행 | 3.1의 근본 원인 진단에 도움                                                               |
| v26.7.7          | 미디어 프리뷰 동기화 검사를 매 재생 tick(~300ms) → 약 5초로 스로틀                               | 프리뷰 기능은 포크에 없지만 **업스트림도 이 영역의 과도한 폴링을 문제로 인식**했다는 신호 |
| v26.7.0, v26.6.1 | GPU 크래시 복구 재실행 액션, GPU 크래시 진단 수집                                                | 3.1                                                                                       |
| v26.7.3          | GPU 프로세스를 끄는 CI 전용 변경 (`27fc8257c`)                                                   | 앱 동작과 무관                                                                            |

## 5. 착수 순서 제안

1. **2.1** 하드웨어 가속 상태 확인 — 5분, 최대 효과
2. **2.4** 영상 누적 재생 시 악화 여부 — 3.2 판별
3. 2.4가 양성이면 **3.2 수정** (컴포넌트 스코프 rAF 정리). 업스트림에도 PR 제출 가치 있음
4. 그래도 무거우면 **2.2 / 2.3 / 2.5** 로 디코딩 경로와 코덱 확인
5. 마지막으로 3.3 인터벌 정리
