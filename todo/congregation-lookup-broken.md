# TODO: 회중 이름 검색으로 집회 시간을 가져오지 못하는 문제

- **상태**: 원인 확정 (**실제 호출로 검증 완료**) / 미수정
- **작성일**: 2026-08-06
- **결론**: **코드는 그대로인데 서버 API가 교체되었습니다.** 업스트림은 2026-05-14에 이미 고쳤고, 포크는 그 이전에서 갈라져 깨진 상태입니다.

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
