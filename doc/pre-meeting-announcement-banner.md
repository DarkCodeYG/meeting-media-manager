# 집회 전 안내 배너 (Pre-Meeting Announcement Banner)

## 개요

5분 타이머 중 **잔여 시간 60초 이하**가 되면, 화면 상단 여백에 안내 문구를 배너 형태로 표시한다.
기존 연표어·시계·카운트다운 레이아웃은 **변경 없음**.

---

## 화면 레이아웃

```
┌──────────────────────────────────────┐  ← 화면 상단 (0%)
│                                      │
│   자리에 앉아 집회를 준비해 주세요.   │  ← 안내 배너 (top 0 ~ 약 25%)
│                                      │     position: absolute; top: 0
├──────────────────────────────────────┤
│                                      │
│             [연표어]                 │  ← 기존 flex center (변경 없음)
│                                      │
├──────────────────────────────────────┤
│        [시계 + 원형 카운트]          │  ← 기존 position: absolute; top: 63% (변경 없음)
└──────────────────────────────────────┘  ← 화면 하단 (100%)
```

---

## 메시지 전환 규칙

| 잔여 시간   | 표시 메시지                                                             |
| ----------- | ----------------------------------------------------------------------- |
| 60초 ~ 41초 | 자리에 앉아 집회를 준비해 주세요.                                       |
| 40초 ~ 21초 | 가지고 계신 휴대폰이나 전자장비는 무음 또는 진동모드인지 확인해 주세요. |
| 20초 ~ 0초  | 감사합니다. 이제 곧 집회가 시작합니다.                                  |

> 60초를 초과하거나 타이머가 비활성화되면 배너는 숨겨진다.

---

## 배너 디자인

### 배경 색상

```scss
background: linear-gradient(
  180deg,
  rgba(5, 15, 55, 0.97) 0%,
  // 딥 미드나잇 블루 (상단)
  rgba(18, 38, 100, 0.93) 100% // 딥 사파이어 블루 (하단)
);
```

- 순수 블랙(`#000`) 배경에서 명확히 구분되면서도 고급스러운 딥 네이비 계열
- 하단에 얇은 구분선 추가: `border-bottom: 1px solid rgba(120, 160, 255, 0.25)`

### 텍스트

- 색상: `rgba(255, 255, 255, 0.95)` (순백 near)
- 폰트: `'Wt-ClearText-Bold', 'Noto Serif Variable', serif` (연표어와 동일)
- 크기: `3.2vw`
- 정렬: 가로·세로 중앙
- `text-shadow: 0 1px 12px rgba(80, 120, 255, 0.35)` — 미묘한 블루 후광으로 고급감

### 애니메이션

- 진입: `fade-in` 0.6s ease-in-out
- 전환(메시지 교체): 기존 메시지 fade-out 0.4s → 새 메시지 fade-in 0.4s
- 퇴장: fade-out 0.6s

### 크기

- `height: 22vh`
- `width: 100%`
- `padding: 0 8vw`

---

## 구현 대상 파일

| 파일                            | 변경 내용                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/pages/MediaPlayerPage.vue` | ① `announcementText` computed 추가<br>② `#announcementBanner` div 추가 (`position: absolute; top: 0`) |
| `src/css/app.scss`              | 배너 CSS + 페이드 애니메이션 keyframes                                                                |
| `src/i18n/en.json`              | 영어 번역 3개 추가                                                                                    |
| `src/i18n/ko.json`              | 한국어 번역 3개 추가                                                                                  |
| `src/i18n/cmn-hans.json`        | 중국어(간체) 번역 추가                                                                                |

---

## 구현 로직 (MediaPlayerPage.vue)

```typescript
// remainingSeconds: BroadcastChannel에서 수신 중인 기존 값
const announcementText = computed(() => {
  const s = remainingSeconds.value;
  if (s <= 0 || s > 60) return '';
  if (s > 40) return t('preMeetingAnnouncement1');
  if (s > 20) return t('preMeetingAnnouncement2');
  return t('preMeetingAnnouncement3');
});
```

```html
<!-- MediaPlayerPage.vue template (base-layer 내부, yeartext 위) -->
<Transition name="announcement-fade">
  <div v-if="announcementText" id="announcementBanner">
    <span>{{ announcementText }}</span>
  </div>
</Transition>
```

---

## i18n 키

```json
// ko.json
"preMeetingAnnouncement1": "자리에 앉아 집회를 준비해 주세요.",
"preMeetingAnnouncement2": "가지고 계신 휴대폰이나 전자장비는 무음 또는 진동모드인지 확인해 주세요.",
"preMeetingAnnouncement3": "감사합니다. 이제 곧 집회가 시작합니다."

// en.json
"preMeetingAnnouncement1": "Please be seated and prepare for the meeting.",
"preMeetingAnnouncement2": "Please ensure your mobile phones and electronic devices are on silent or vibrate mode.",
"preMeetingAnnouncement3": "Thank you. The meeting will begin shortly."

// cmn-hans.json
"preMeetingAnnouncement1": "请就座，准备开始聚会。",
"preMeetingAnnouncement2": "请确认您的手机或电子设备已调至静音或振动模式。",
"preMeetingAnnouncement3": "谢谢，聚会即将开始。"
```

---

## 주의사항

- `enablePreMeetingClock` 설정이 비활성화된 경우 배너도 표시되지 않음 (별도 설정 불필요)
- JW 로고(`#yeartextLogoContainer`, `bottom: 13vh; right: 13vh`)와 겹치지 않음
- 배너는 `base-layer` 내부에서 `position: absolute; top: 0`으로 배치하므로 다른 레이어 z-index에 영향 없음
