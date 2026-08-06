# TODO: 회중 이름 검색으로 집회 시간을 가져오지 못하는 문제

- **상태**: 검색 기능 **수정 완료**(커밋 `d7a7811f9`, 사용자 확인됨). 이식 과정에서 발생한 **회귀 2건도 수정 완료**(`5b29e2b88`, custom.5) — 아래 회귀 절 참고
- **작성일**: 2026-08-06 / **최종 갱신**: 2026-08-06 (회귀 2건 반영)
- **결론**: **코드는 그대로인데 서버 API가 교체되었습니다.** 업스트림은 2026-05-14에 이미 고쳤고, 포크는 그 이전에서 갈라져 깨져 있었습니다.
- **미해결**: 미디어 창 연표어 미표시. 이 이식과의 인과관계를 아직 확인하지 못했습니다 — 아래 "연표어 미표시" 절 참고

## 수정 내용 요약

업스트림 `d7bb389db` 를 4개 파일에 이식했습니다(그 이후의 UI 전면 개편 `eff84d9b8` 는 제외).

| 파일                                                 | 변경                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/congregation-lookups.d.ts`                | `GeoRecord` → `CongRecord` / `CongregationMeeting` / `CongregationSearchResult` / `MeetingSearchResponse` / `MeetingLanguage`    |
| `src/helpers/congregation-schedule.ts`               | `fetchCongregationSuggestions` 신규, `fetchMeetingLocations` 재작성, `getMeetingLanguageMap` 신규, `syncMeetingSchedule` 2단계화 |
| `src/components/dialog/DialogCongregationLookup.vue` | 디바운스(500ms) 제안 목록 → 선택 시 상세 조회                                                                                    |
| `src/migrations/auto-enroll-meeting-sync.ts`         | 자동 등록도 2단계 흐름                                                                                                           |

### ⚠️ 이 이식으로 발생한 회귀 3건

**1과 3은 사용자가 실사용에서 발견했습니다. 둘 다 빌드·린트·타입체크·테스트를 모두 통과한 상태로 배포되었습니다.**

1. **설정된 언어를 영어로 덮어썼습니다.** (v26.4.7-custom.4 에서 수정, 커밋 `5b29e2b88`)

   포크의 `dc35bc400` 은 `writtenLanguageCode` 로 구어 언어를 written 변형에 매핑했지만 그 필드는 폐기된 엔드포인트에만 있었습니다. 이식한 코드는 `lang = resolvedLangCode || 'E'` 였고, **중국어 회중의 집회 언어는 `CHM`**(구어, 앱의 written 언어 목록에 없음)이라 매칭이 실패해 **정상 동작 중이던 `CHS` 설정이 영어로 교체**되었습니다.

   증상은 두 가지로 나타났습니다 — 병음 노래 토글이 사라짐(`HeaderCalendar.vue` 에서 `lang === 'CHS'` 로 게이팅), 연표어가 사라짐(언어별로 저장됨).

   수정: 언어가 **실제로 해석됐을 때만** 적용(실패 시 기존 설정 유지) + `SPOKEN_TO_WRITTEN_LANG = { CHM: 'CHS' }`. 매핑은 실제 API 응답으로 확인했고 `congregation-schedule.test.ts` 에 고정했습니다.

   **교훈**: 업스트림 코드를 이식할 때 **폴백 기본값이 파괴적인지** 반드시 따져야 합니다. `|| 'E'` 는 "못 찾으면 영어"가 아니라 "못 찾으면 사용자 설정을 파괴"였습니다.

2. **집회 요일이 하루씩 밀려 저장됐습니다.** (v26.4.7-custom.5 에서 수정)

   API는 요일을 **0=일요일** 기준 0-6으로 주고, 앱의 `mwDay`/`weDay` 는 **0=월요일** 기준 0-6입니다. 이식한 코드는 `apiDay + 1` 을 `normalizeSchedule` 에 넘겼고 그쪽이 다시 `- 1` 하므로 **상쇄되어 API 값이 그대로 저장**되었습니다.

   앱 규약의 근거 두 곳:
   - [`helpers/date.ts`](../src/helpers/date.ts) `getWeekDay()` — `getDay() === 0 ? 6 : getDay() - 1`
   - [`SelectInput.vue`](../src/components/form-inputs/SelectInput.vue) `filteredDays` — `days[i === 6 ? 0 : i + 1]`, 즉 값 `'0'` 의 라벨이 월요일

   **증상**: 일요일 주말집회가 월요일로 저장 → 일요일이 주말집회로 인식되지 않음 → `pt` 섹션이 생성되지 않음 → **공개강연 연제 입력 카드가 사라짐**. 미디어 가져오기와 사전집회 시계(`useTimer` 가 `weDay` 를 읽음)도 함께 어긋납니다.

   **실측 확인 (2026-08-06, 사용자 프로필 사본 + CDP)**

   실제 회중(`서울남부중국어`, guid `e05880d6-…`)의 API 응답과 앱에 저장된 값:

   |          | API                | 올바른 앱 값 | 실제 저장된 값       |
   | -------- | ------------------ | ------------ | -------------------- |
   | 주중집회 | `4` = 목요일 19:30 | `mwDay=3`    | `mwDay="4"` = 금요일 |
   | 주말집회 | `0` = 일요일 16:00 | `weDay=6`    | `weDay="0"` = 월요일 |

   시간(19:30 / 16:00)은 정확하고 요일만 밀렸습니다. 생성된 섹션도 전부 하루 늦습니다:

   ```
   2026-08-03 (월) -> pt,wt          ← 8월 2일 일요일이어야 함
   2026-08-07 (금) -> tgw,ayfm,lac   ← 8월 6일 목요일이어야 함
   ```

   날짜 선택기 UI에서도 집회 표시 점이 월요일·금요일 열에만 찍힙니다.

   > `lookupPeriod` 의 `date` 는 `2026-08-02T15:00:00.000Z` 형태(= KST 자정)입니다. **`slice(0,10)` 으로 요일을 계산하면 하루 이르게 나옵니다** — 조사 중 이것 때문에 한 번 오판했습니다. `new Date(d.date)` 로 로컬 해석해야 합니다.

   **주의: 요일 수정만으로는 카드가 돌아오지 않습니다.** 카드는 [`MediaList.vue:37`](../src/components/media/MediaList.vue#L37) 에서 `enablePublicTalkTitle` 도 요구하며, 확인한 프로필에서는 이 값이 `false` 였습니다. 두 조건이 모두 필요합니다.

   **자동 복구가 안 되는 경우가 있습니다.** `syncMeetingSchedule` 은 `congregationNameModified` 가 `true` 면 중단되고 **이 검사는 `force` 로도 우회되지 않습니다**([congregation-schedule.ts:188](../src/helpers/congregation-schedule.ts#L188)). 확인한 프로필이 이 상태였으므로, 자동 동기화도 "집회 일정 새로 고침" 버튼도 동작하지 않습니다 → **요일을 직접 설정해야 합니다.**

   **피해 범위가 수동 검색보다 넓습니다.** `syncMeetingSchedule` 은 [`MainLayout.vue:306`](../src/layouts/MainLayout.vue#L306) 에서 회중 전환/앱 시작 시 자동 실행되므로(`enableAutomaticMeetingScheduleUpdates` 켜짐 + 회중 이름 미수정), 검색을 한 번도 하지 않은 사용자도 영향을 받습니다. 같은 이유로 **수정 후에는 자동 동기화가 요일을 되돌립니다** — 설정이 꺼져 있으면 수동으로 고쳐야 합니다.

   수정: `apiDayToScheduleWeekday()` = `((apiDay + 6) % 7) + 1` 를 두 호출부에서 공용.

   **교훈**: 두 시스템 사이에서 값을 변환하는 코드는 **양쪽 규약을 코드로 확인**해야 합니다. 최초 작업 시 주석에 "0-6 Sunday first → 1-7" 이라고만 적고 앱 쪽 규약은 확인하지 않았습니다. `getWeekDay()` 를 5분 읽으면 드러나는 문제였습니다. 테스트도 중간값(1-7)이 아니라 **`normalizeSchedule` 을 통과해 실제 저장되는 값**을 검증해야 합니다 — 중간값만 봤다면 상쇄되는 이 버그를 놓칩니다.

3. **검색 목록에서 집회 시간·언어 미리보기가 사라졌습니다.** (미해결 — 업스트림과 동일한 선택)
   1단계 응답이 이름과 guid만 주므로 목록에 시간을 넣으려면 항목마다 상세 요청이 필요합니다. 대신 회중 번호가 포함된 `formattedName` 을 표시합니다(동명 회중 구분용). 업스트림도 같은 선택을 했습니다.

### 검증 상태

- `yarn lint` ✅ / 테스트 264개 ✅ — 다만 **외부 API 의존이라 자동 테스트로 이 기능을 검증할 수 없습니다**
- 엔드포인트 자체는 실제 호출로 확인 (아래 0절)
- **앱에서 실제 회중 이름으로 검색해 집회 시간이 채워지는지 확인이 필요합니다**

## 0. 실측 검증 결과 (2026-08-06)

추정이 아니라 실제로 호출해 확인했습니다.

| 엔드포인트                                                     | 결과                         |
| -------------------------------------------------------------- | ---------------------------- |
| `apps.jw.org/api/public/meeting-search/weekly-meetings` (포크) | **HTTP 404**                 |
| `hub.jw.org/meetings/api/congregations` (업스트림 1단계)       | **HTTP 200**, 정상 데이터    |
| `hub.jw.org/meetings/api/meeting-search` (업스트림 2단계)      | **HTTP 200**, 집회 시간 포함 |

2단계 흐름이 끝까지 동작합니다. 1단계 응답의 `congregationGuid` 를 2단계의 `meetingLocationEventGuid` 파라미터에 그대로 넘기면 됩니다.

**1단계 응답** (`?congregationName=seoul`):

```json
[
  {
    "congregationGuid": "0802cd0e-…",
    "formattedName": "서울서강 (3160)",
    "name": "서울서강"
  },
  {
    "congregationGuid": "2980f724-…",
    "formattedName": "서울신당 (3343)",
    "name": "서울신당"
  }
]
```

**2단계 응답** (`?first=20&meetingLocationEventGuid=0802cd0e-…`):

```json
{
  "items": [
    {
      "id": "771f995b-…",
      "latitude": 37.551994,
      "longitude": 126.936574,
      "congregationMeetings": [
        {
          "id": "0802cd0e-…",
          "languageGuid": "471312c0-…",
          "name": "서울서강",
          "transliteratedName": "SEOUL SEOGANG",
          "midweekMeetingDay": 4,
          "midweekMeetingTime": "19:30:00",
          "weekendMeetingDay": 0,
          "weekendMeetingTime": "10:00:00",
          "address": "…",
          "phoneNumber": "02-718-1935"
        }
      ]
    }
  ]
}
```

구현 시 알아둘 점:

- 언어가 `languageCode` 문자열이 아니라 **`languageGuid`** 입니다. 그래서 업스트림이 `hub.jw.org/meetings/api/languages` 로 매핑 테이블을 받아 씁니다(`getMeetingLanguageMap`). 포크의 중국어 변형 매칭 로직도 이 GUID 기반으로 다시 맞춰야 합니다.
- 요일이 **`weekendMeetingDay: 0`(일요일)** 형태입니다. 업스트림 `f890cc5d6 chore: fix sun-sat 0-6 remote day lookups to align with mon-sun 1-7/0-6 expectation` 가 이 변환을 다루므로 함께 확인하세요 — 틀리면 집회일이 하루 밀립니다.
- 인증 헤더 없이 조회됩니다(위 검증은 평범한 GET).

## 1. 증상

설정에서 회중 이름으로 검색해 집회 시간·언어를 자동으로 가져오는 기능이 결과를 반환하지 않습니다. 앱 코드는 변경되지 않았습니다.

## 2. 원인 — API 엔드포인트가 사라졌습니다

업스트림 커밋 [`d7bb389db`](https://github.com/sircharlo/meeting-media-manager/commit/d7bb389db) (2026-05-14):

> **fix: update meetings API for congregation lookup that had broken since early May**; add debounced suggestions and language mapping (#7517)

즉 **2026년 5월 초에 JW 측 API가 바뀌었고**, 업스트림은 그것을 확인해 새 API로 이전했습니다. 포크의 분기점은 2026-04-05이므로 이 수정이 들어오지 않았습니다.

### 엔드포인트 대조

| 용도      | 포크 (현재, 동작 안 함)                                         | 업스트림 (현재)                                  |
| --------- | --------------------------------------------------------------- | ------------------------------------------------ |
| 회중 검색 | `https://apps.{base}/api/public/meeting-search/weekly-meetings` | `https://hub.jw.org/meetings/api/congregations`  |
| 집회 상세 | (위 호출 하나로 처리)                                           | `https://hub.jw.org/meetings/api/meeting-search` |
| 언어 목록 | `https://apps.{base}/api/public/meeting-search/languages`       | `https://hub.jw.org/meetings/api/languages`      |

**도메인 자체가 `apps.jw.org` → `hub.jw.org` 로 바뀌었고, 경로 구조도 다릅니다.**

### 호출 방식도 1단계 → 2단계로 바뀌었습니다

포크 ([congregation-schedule.ts:192-211](../src/helpers/congregation-schedule.ts#L192-L211)) — 한 번에 처리:

```ts
fetchJson(
  'https://apps.{base}/api/public/meeting-search/weekly-meetings',
  new URLSearchParams({
    includeSuggestions: 'true',
    keywords,
    latitude: '0',
    longitude: '0',
    searchLanguageCode: '',
  }),
);
// → { geoLocationList: GeoRecord[] }
```

업스트림 — 제안 목록과 상세 조회를 분리:

```ts
// 1단계: 이름으로 회중 후보 검색
fetchCongregationSuggestions(keywords)
  → GET hub.jw.org/meetings/api/congregations?congregationName={keywords}
  → CongregationSearchResult[]   // 각 항목에 meetingLocationEventGuid 포함

// 2단계: 선택한 후보의 guid로 집회 상세 조회
fetchMeetingLocations(meetingLocationEventGuid)
  → GET hub.jw.org/meetings/api/meeting-search?first=20&meetingLocationEventGuid={guid}
  → MeetingSearchResponse { hasResultsOutsideViewport, items[] }
```

응답 타입이 완전히 다릅니다: `geoLocationList: GeoRecord[]` → `items[].congregationMeetings[]`.

## 3. 영향 범위 — 포크에서 손대야 할 파일

업스트림 커밋이 건드린 4개 파일이 그대로 대응됩니다 (총 +213/-149).

| 파일                                                 | 포크에서 할 일                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/helpers/congregation-schedule.ts`               | `fetchMeetingLocations` 재작성, `fetchCongregationSuggestions` 신규, `getMeetingLanguageMap` 엔드포인트 변경, `getExactCongregationMatch` 신규 |
| `src/types/congregation-lookups.d.ts`                | `GeoRecord` → `CongregationSearchResult` / `MeetingSearchResponse` / `MeetingLanguage` 로 타입 교체                                            |
| `src/components/dialog/DialogCongregationLookup.vue` | 1단계→2단계 흐름으로 UI 변경(디바운스 제안 목록 → 선택 → 상세). 업스트림에서 **185줄 중 대부분 재작성**                                        |
| `src/migrations/auto-enroll-meeting-sync.ts`         | 자동 등록 마이그레이션도 새 흐름을 사용                                                                                                        |

## 4. 주의할 점 — 그냥 체리픽하면 안 되는 이유

1. **포크 전용 언어 매칭 로직이 있습니다.** 포크는 `dc35bc400 fix: improve congregation lookup language matching for Chinese variants` 로 중국어 변형(`cmn-hans` 등) 처리를 자체 추가했고, 현재 [DialogCongregationLookup.vue:190-206](../src/components/dialog/DialogCongregationLookup.vue#L190-L206)에서 `congregationLookupLanguages` 와 `locales` 를 대조해 앱 로케일로 매핑합니다. 업스트림의 새 구현에도 언어 매핑이 있으나(`getMeetingLanguageMap`) **중국어 변형 처리는 포크 고유**이므로 새 흐름 위에 다시 얹어야 합니다.

2. **`urlVariables.base` 사용이 사라집니다.** 포크는 `https://apps.${urlVariables.base || 'jw.org'}` 로 설정된 베이스 URL을 따르지만, 업스트림의 새 엔드포인트는 `hub.jw.org` 를 하드코딩합니다. 커스텀 베이스 URL을 쓰는 회중이 있으면 동작이 달라집니다 — 이식 시 판단이 필요합니다.

3. **`eff84d9b8 refactor: refresh app-wide design language and UX`** (2026-07-30)가 같은 파일을 다시 건드렸습니다. 그 커밋은 디자인 전면 개편이라 포크에 가져오면 UI가 크게 바뀝니다. **API 수정만 원하면 `d7bb389db` 기준으로 이식하고 그 이후 UI 변경은 제외**해야 합니다.

## 5. 착수 순서 제안

1. **엔드포인트가 실제로 죽었는지 먼저 확인**하세요. 추정으로 큰 수정을 시작하지 않는 것이 좋습니다:

   ```powershell
   # 구 엔드포인트 (포크가 쓰는 것)
   curl "https://apps.jw.org/api/public/meeting-search/weekly-meetings?keywords=seoul&latitude=0&longitude=0&includeSuggestions=true&searchLanguageCode="
   # 신 엔드포인트 (업스트림이 쓰는 것)
   curl "https://hub.jw.org/meetings/api/congregations?congregationName=seoul"
   ```

   구 엔드포인트가 404/빈 결과, 신 엔드포인트가 정상 응답이면 확정입니다.

2. `src/types/congregation-lookups.d.ts` 타입부터 교체 (컴파일러가 나머지 수정 지점을 알려줍니다).
3. `congregation-schedule.ts` 의 fetch 함수 3개 교체.
4. `DialogCongregationLookup.vue` 를 2단계 흐름으로 변경 — **포크의 중국어 변형 언어 매칭을 보존**할 것.
5. `auto-enroll-meeting-sync.ts` 마이그레이션 갱신.
6. 실제 회중 이름으로 수동 검증 (자동 테스트로는 외부 API를 검증할 수 없습니다).

## 6. 관련 문서

- 업스트림 갭 전반: [upstream-sync-gap.md](./upstream-sync-gap.md)
- 이 항목은 그 문서의 P1(실사용 체감 장애)에 해당하며, **기능이 완전히 죽어 있으므로 우선순위가 높습니다.**
