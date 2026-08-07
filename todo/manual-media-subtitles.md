# TODO: 자막이 표시되지 않는 버그들

- **상태**: 4건 모두 수정 완료 — 수동 추가 영상 `100878ef9`(custom.1) / `.jwpub` 관문 custom.6 / **mediator API 공백 custom.7** / **추출 타이밍 custom.7**
- **작성일**: 2026-08-05 / **최종 갱신**: 2026-08-07 (실사용 테스트로 드러난 2건 추가)

> ⚠️ **custom.6 의 `.jwpub` 수정만으로는 사용자 사례가 해결되지 않았습니다.** 관문(`isVideo(FilePath)`)은 실재하는 결함이었지만 — 아직 내려받지 않은 미디어에 해당합니다 — 사용자의 항목은 이미 mp4 가 내려받아진 상태여서 관문을 통과했고 **그 다음 단계인 API 조회에서 막혔습니다**(아래 0.2절). `GETPUBMEDIALINKS` 로 자막 존재를 확인한 것에 만족하고 **앱이 실제로 어느 API 를 쓰는지 확인하지 않은 것**이 원인입니다.

## 문서 구성

| 절  | 내용                                                                  | 상태          |
| --- | --------------------------------------------------------------------- | ------------- |
| 0.1 | 추출 완료 전 재생 시 스냅샷이 빈 값으로 고정                          | custom.7 수정 |
| 0.2 | mediator API 에 없는 publication 의 자막 조회 실패                    | custom.7 수정 |
| 0   | `.jwpub` 영상의 `FilePath` 가 썸네일이라 관문에서 걸림                | custom.6 수정 |
| 1–7 | **착수 전 설계 문서** (custom.1 로 구현 완료) — 현재 코드 상태가 아님 | 참고용        |

## 0.1 재생 시점 스냅샷 때문에 추출된 자막이 반영되지 않음 (custom.7)

**증상**: 내장 자막이 있는 영상을 수동 추가하고 재생했는데 자막이 나오지 않음. 스토어에는 `subtitlesUrl` 이 정상적으로 들어 있음.

**실측 (사용자 파일 `1112024059_CHS_cnt_1_r720P.mp4`, 166 MB / 17분)**

| 확인 항목                    | 결과                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| 내장 자막 트랙               | ✅ `Stream #0:2(cmn): Subtitle: mov_text (tx3g)`               |
| ffmpeg 추출 산출물           | ✅ `Temp\1112024059_CHS_cnt_1_r720P-9cd51880.vtt` 18.4 KB      |
| VTT 유효성                   | ✅ 바이트가 `57 45 42 56 54 54 0A 0A` = `WEBVTT\n\n`, BOM 없음 |
| 스토어 항목의 `subtitlesUrl` | ✅ 위 VTT 를 가리킴                                            |
| `enableSubtitles`            | ✅ `true`                                                      |

즉 파이프라인 전체가 동작했는데도 화면에 나오지 않았습니다.

**원인**: [`MediaItem.vue:1451`](../src/components/media/MediaItem.vue#L1451) 이 `subtitlesUrl: media.subtitlesUrl ?? ''` 로 **재생 시작 시점의 값을 복사**합니다. `backfillEmbeddedSubtitles` 는 의도적으로 await 하지 않으므로(FFmpeg 최초 사용 시 다운로드가 필요) 긴 영상에서는 추출이 수 분 걸립니다. **추출 완료 전에 재생을 시작하면 빈 문자열이 그 재생 내내 고정**됩니다. 아무 표시도 없어 사용자에게는 그냥 "안 되는" 것으로 보입니다.

**수정**: 추출이 끝나 스토어 항목을 패치할 때, 그 항목이 재생 중이면 `currentState.mediaPlaying.subtitlesUrl` 도 갱신합니다. [`MediaCalendarPage.vue:339-344`](../src/pages/MediaCalendarPage.vue#L339-L344) 가 이 필드를 감시해 미디어 창으로 post 합니다.

> **미확인**: `<track>` 에 `default` 속성이 있지만([`MediaPlayerPage.vue:122-127`](../src/pages/MediaPlayerPage.vue#L122-L127)), **재생 중에 동적으로 추가된 트랙을 Chromium 이 자동 활성화하는지는 확인하지 못했습니다.** `default` 는 원래 리소스 선택 시점에 적용되는 속성입니다. 활성화되지 않는다면 필요한 것은 트랙 `mode = 'showing'` 을 명시적으로 지정하는 것입니다.
>
> 다만 **최악의 경우가 기존 동작과 같습니다** — 스토어 항목에는 URL 이 남으므로 그 항목을 **다시 재생하면 스냅샷이 올바른 값을 집어 확실히 표시됩니다.** 그래서 이 수정만으로도 "영구히 안 나옴"이 "다시 재생하면 나옴"으로 바뀝니다.

**이미 추가해 둔 항목은 스토어에 URL 이 있으므로 다시 재생하면 나옵니다.**

## 0.2 mediator API 에 없는 publication 의 자막을 못 찾음 (custom.7)

**증상**: `.jwpub` 에서 추가한 영상의 `subtitlesUrl` 이 비어 있음. custom.6 의 관문 수정 이후에도 동일.

**원인**: [`getJwMediaInfo`](../src/helpers/jw-media.ts) 는 **mediator API** 만 조회하는데(`fetchMediaItems`), 미디어 목록형 publication 은 거기에 인덱싱되어 있지 않습니다.

```
mediator:   /v1/media-items/CHS/pub-S-341-26v_1_VIDEO  → media: []      ← 없음
pub-media:  GETPUBMEDIALINKS?pub=S-341-26v&track=1&langwritten=CHS
              → subtitles.url = .../S-341-26v_CHS_01.vtt                ← 있음
```

거기에 더해 [`MediaLink`](../src/types/jw/publications.d.ts) 타입에 **`subtitles` 필드가 선언되어 있지 않았습니다.** 실제 응답에는 있는데 타입에 없어서, `getJwMediaInfo` 가 `!isMediaLink(best)` 로 pub-media 쪽 파일을 아예 배제하고 있었습니다.

**수정**: mediator 응답이 비면 pub-media 로 폴백해 `duration` 과 `subtitles` 를 채웁니다. `title`/`thumbnail` 은 pub-media 응답에 없으므로 빈 값이지만, **현재 이 경우의 반환값이 `emptyResponse`(0과 빈 문자열)이므로 어떤 호출부도 퇴행하지 않습니다.** 타입에도 실제 응답으로 확인한 `subtitles` 를 선언했습니다.

`getPubMediaLinks` 대신 `fetchPubMediaLinks` 를 호출합니다 — 전자는 응답이 없을 때 `downloadProgress` 에 오류를 표시하는데, 이것은 다운로드가 아니라 조회이므로 UI 에 오류가 뜨면 안 됩니다.

**테스트**: `src/helpers/__tests__/jw-media-info-fallback.test.ts` 4개. **폴백을 제거하면 핵심 2개가 실패함을 확인**했습니다.

> 함정: `isMediaLink(item)` 은 `!('progressiveDownloadURL' in item)` 로 판별합니다. mediator 파일에만 그 필드가 있으므로, 테스트에서 mediator 응답을 흉내낼 때 이 필드를 빠뜨리면 pub-media 파일로 오인됩니다.

## 0. `.jwpub` 미디어 목록의 영상 자막 (2026-08-06, custom.6)

**증상**: `S-418mp-26_CHS_002.jwpub` 을 JW Library 에서 열면 자막이 나오지만, M³ 에 드래그해 넣고 재생하면 안 나옴.

**원인**: [`getSubtitlesUrl`](../src/helpers/fs.ts) 의 영상 판정이 호출자와 달랐습니다.

```js
// dynamicMediaMapper (호출자) — MimeType 우선, FilePath 는 보조
const isVideoFile = m.MimeType?.includes('video') || isVideo(m.FilePath);
subtitlesUrl: isVideoFile ? await getSubtitlesUrl(m, duration) : '',

// getSubtitlesUrl (내부) — FilePath 만 봄  ← 여기서 걸림
if (isVideo(multimediaItem.FilePath) && KeySymbol && Track) { ... }
```

`.jwpub` 의 영상 행은 **`FilePath` 가 영상이 아닙니다.** `Multimedia` 행이 미리보기 이미지를 `LinkMultimediaId` 로 참조하면 [`jw-media.ts:2328-2340`](../src/helpers/jw-media.ts#L2328-L2340) 이 **그 이미지의 경로를 영상 행에 복사**하고 이미지 행을 걸러냅니다. 그래서 살아남는 항목은 `.jpg` 경로를 가진 영상이고, `isVideo(FilePath)` 가 거짓이 되어 자막 조회가 아예 시도되지 않았습니다.

### 실측 확인

사용자가 드래그한 실제 파일(`C:\Users\langk\Downloads\S-418mp-26_CHS_002.jwpub`)의 DB를 조회한 결과:

```
{MultimediaId: 1, MimeType: 'image/jpeg', FilePath: 'S-341-26v_univ_wsr_01.jpg'}
{MultimediaId: 2, LinkMultimediaId: 1, MimeType: 'video/mp4', KeySymbol: 'S-341-26v', Track: 1}
```

영상 행에는 `FilePath` 가 **없고** `KeySymbol`/`Track` 은 **있습니다.** 그리고 미디어 API 는 자막을 정상 제공합니다:

```
GETPUBMEDIALINKS?pub=S-341-26v&track=1&langwritten=CHS&fileformat=MP4
  -> subtitles: https://cfp2.jw-cdn.org/a/590135f/1/o/S-341-26v_CHS_01.vtt
```

즉 **자막은 받아올 수 있었고 관문만 막고 있었습니다.**

### 수정

영상 판정을 호출자와 일치시켰습니다(`MimeType` 우선, `FilePath` 보조). 함께 제거한 것:

```js
let subtitlesPath = multimediaItem.FilePath.split('.')[0] + '.vtt';
```

이 줄은 아래에서 무조건 덮어써지는 **죽은 코드**였고, 두 가지 문제가 있었습니다 — `split('.')[0]` 은 경로 중간의 점에서 잘리고(사용자 이름·버전 폴더 등), `FilePath` 가 없는 항목에서는 `undefined.split` 으로 **예외**가 납니다. 관문을 완화하면 실제로 그 경로에 도달하므로 제거가 선택이 아니라 필수였습니다.

**테스트**: `src/helpers/__tests__/subtitles-lookup.test.ts` 6개. 실제 DB 행 모양을 그대로 쓰고, **수정 전 코드에서 2개가 실패함을 확인**했습니다(나머지 4개는 관문 유지 검증용).

---

# 이하: 착수 전 분석 (2026-08-05, custom.1 로 구현 완료)

> **아래 §1–§7 은 구현 전에 작성한 설계 문서입니다.** 현재 코드 상태를 서술하지 않으므로 그대로 읽으면 오해합니다. 남겨 두는 이유는 세 가지입니다 — §3 의 업스트림 조사(동기화로 해결되지 않음을 확인한 근거), §5 의 함정 목록(ffprobe 부재, 비트맵 자막 등 여전히 유효), §6 의 검증 절차.
>
> **기준 커밋**: `86e81174a` (origin/master), upstream 비교 기준 `upstream/master` @ 2026-08-03
> **분류**: 기능 누락(missing feature)에 가까운 버그. 업스트림에 수정 없음.

## 1. 증상

- Library에 **자동으로 추가된** 영상(JW.org 발행물 미디어)은 자막이 정상 표시됨.
- **수동으로 추가한** 영상은 파일 안에 자막이 포함되어 있어도 자막이 표시되지 않음.

## 2. 근본 원인 (당시 상태)

M³의 자막은 **영상 파일과 별개인 외부 WebVTT 파일**을 `<track>` 엘리먼트로 붙이는 방식만 지원합니다.
컨테이너에 내장된 자막 스트림(soft subtitle, 예: MP4의 `mov_text`, MKV의 `subrip`)은 어디에서도 읽지 않습니다.

### 2.1 재생 측 — 외부 VTT만 렌더링

[src/pages/MediaPlayerPage.vue:122-127](../src/pages/MediaPlayerPage.vue#L122-L127) (및 169-174의 두 번째 `<video>`)

```
<track v-if="mediaPlayerSubtitlesUrl && subtitlesVisible" kind="subtitles" :src="mediaPlayerSubtitlesUrl" />
```

`mediaPlayerSubtitlesUrl` 이 빈 문자열이면 `<track>` 자체가 렌더링되지 않습니다.
그리고 코드베이스 전체에 `video.textTracks` / `addTextTrack` 사용처가 **하나도 없습니다** → 내장 자막 트랙을 활성화하는 경로가 없음.

### 2.2 자막 URL 생성 측 — JW 발행물 전용

[src/helpers/fs.ts:262-310](../src/helpers/fs.ts#L262-L310) `getSubtitlesUrl()`

```
if (isVideo(multimediaItem.FilePath) && multimediaItem.KeySymbol && multimediaItem.Track) {
  ...
  const { duration, subtitles } = await getJwMediaInfo(subtitleFetcher);
  if (!subtitles) return '';
  ... downloadFileIfNeeded(...)   // JW API에서 .vtt 다운로드
}
```

- `KeySymbol`(발행물 심볼) + `Track`(트랙 번호)이 **둘 다 있어야** 동작 → JW.org 발행물 미디어 전용.
- 자막을 JW 미디어 API에서 별도 다운로드함 → 로컬 파일에는 적용 불가.
- 참고: 275행에 `subtitlesPath = FilePath.split('.')[0] + '.vtt'` 라는 **sidecar 경로 계산이 이미 있지만** 303행에서 즉시 덮어써지고 폴백으로도 쓰이지 않습니다. 원저자도 sidecar를 고려했던 흔적으로 보이며, 아래 해결안 A의 착수점입니다.

### 2.3 수동 추가 경로 — `subtitlesUrl` 을 아예 설정하지 않음

[src/helpers/jw-media.ts:261-350](../src/helpers/jw-media.ts#L261-L350) `addToAdditionMediaMapFromPath()`

`jwStore.addToAdditionMediaMap()` 에 넘기는 객체에 `duration`, `thumbnailUrl`, `isVideo` 등은 채우지만 **`subtitlesUrl` 키가 없습니다**.

반면 자동 추가 경로는 [src/helpers/jw-media.ts:1830](../src/helpers/jw-media.ts#L1830) 에서 채웁니다:

```
subtitlesUrl: isVideoFile ? await getSubtitlesUrl(m, duration) : '',
```

### 2.4 전체 흐름

```
수동 추가: addToAdditionMediaMapFromPath()  →  subtitlesUrl 미설정 (undefined)
             ↓
           MediaItem.vue:1447   media.subtitlesUrl ?? ''      →  ''
             ↓
           MediaCalendarPage.vue:1530  postSubtitlesUrl('')   →  BroadcastChannel 'subtitles-url'
             ↓
           MediaPlayerPage.vue:122  v-if="mediaPlayerSubtitlesUrl && ..."  →  false
             ↓
           <track> 미생성  →  자막 없음
```

관련 위치: [src/components/media/MediaItem.vue:1447](../src/components/media/MediaItem.vue#L1447), [src/pages/MediaCalendarPage.vue:1530](../src/pages/MediaCalendarPage.vue#L1530), [src/components/media/SubtitlesButton.vue](../src/components/media/SubtitlesButton.vue) (버튼은 `enableSubtitles` 설정만 보고 표시되므로, 자막이 없는 항목에서도 버튼이 켜져 있어 사용자 혼란을 유발함).

## 3. 업스트림 수정 여부 — **없음**

merge-base `2738d7526` (2026-04-05) 이후 upstream/master의 비병합 커밋 1807개(노이즈 제외 407개)를 검사한 결과, 자막 관련 커밋은 2개뿐이며 **둘 다 무관**합니다.

| 커밋        | 날짜       | 제목                                                                          | 관련성                        |
| ----------- | ---------- | ----------------------------------------------------------------------------- | ----------------------------- |
| `9157f1c63` | 2026-07-15 | feat: polish media UI with tonal buttons, tag redesign, and section subtitles | 무관 (UI의 "섹션 부제목")     |
| `c08a47026` | 2026-06-08 | fix: JWPUB media labels and captions could sometimes be inconsistent          | 무관 (JWPUB 라벨/캡션 텍스트) |

또한 `src/helpers/fs.ts`의 `getSubtitlesUrl` 본문과 `MediaPlayerPage.vue`의 `<track>` 블록은 업스트림에서도 구조적으로 바뀌지 않았습니다.

→ **업스트림 동기화로는 해결되지 않습니다. 자체 구현 필요.**

## 4. 자체 해결 가능성 — **가능**. 단, 자막 종류에 따라 난이도가 다름

먼저 문제의 영상이 어떤 자막인지 확인해야 합니다.

| 자막 종류                                         | 현재 동작 | 대응                                   |
| ------------------------------------------------- | --------- | -------------------------------------- |
| 하드섭 (영상에 태워진 픽셀)                       | 이미 보임 | 대응 불필요. 안 보인다면 하드섭이 아님 |
| 사이드카 파일 (`영상.srt` / `영상.vtt` 별도 파일) | 무시됨    | **해결안 A** — 쉬움                    |
| 내장 소프트 자막 (컨테이너 내부 스트림)           | 무시됨    | **해결안 B** — 중간                    |

> 사용자 증상("영상에 자막이 포함되어있음에도")은 **내장 소프트 자막**을 가리킬 가능성이 높습니다 → 해결안 B가 본 수정. A는 저비용이라 함께 넣는 것이 좋습니다.

### 해결안 A — 사이드카 자막 파일 인식 (난이도: 낮음)

1. `getSubtitlesUrl()` 을 확장하거나 신규 헬퍼 `getLocalSubtitlesUrl(filePath)` 추가.
2. 영상과 같은 디렉터리에서 `<basename>.vtt`, `<basename>.srt`, `<basename>.<lang>.vtt` 를 탐색.
3. `.srt` 는 WebVTT로 변환 필요 (Chromium `<track>` 은 SRT 미지원). 순수 문자열 변환으로 충분:
   - 헤더 `WEBVTT\n\n` 추가
   - 타임코드 `00:00:01,000` → `00:00:01.000` (콤마 → 점)
   - 변환 결과는 썸네일 캐시와 같은 캐시 디렉터리에 저장
4. `addToAdditionMediaMapFromPath()` 의 객체에 `subtitlesUrl` 추가.
5. `FilePath.split('.')[0]` 은 경로 중간에 점이 있으면 깨집니다 — `upath`의 `changeExt()` 를 사용할 것.

### 해결안 B — 내장 자막 스트림 ffmpeg 추출 (난이도: 중간)

**Chromium의 `<video>` 는 컨테이너 내장 자막 트랙을 노출하지 않습니다.** `HTMLMediaElement.textTracks` 는 `<track>` 으로 추가한 트랙만 반환하므로, 내장 자막은 **추출해서 외부 VTT로 만들어야** 합니다.

다행히 이 프로젝트에는 ffmpeg 인프라가 이미 갖춰져 있습니다:

- [src/helpers/fs.ts:347](../src/helpers/fs.ts#L347) `setupFFmpeg()` — ffmpeg 바이너리를 자동 다운로드/캐시하고 `currentState.ffmpegPath` 에 저장
- [src-electron/main/ffmpeg.ts:119](../src-electron/main/ffmpeg.ts#L119) `createVideoFromNonVideo()` — fluent-ffmpeg 사용 패턴 + 중복 실행 방지 큐 + 캐시 재사용 로직(`shouldUseExistingConversion`)
- [src-electron/main/ipc.ts:363](../src-electron/main/ipc.ts#L363) — 렌더러 → 메인 IPC 핸들러 등록 패턴

구현 단계:

1. **`src-electron/main/ffmpeg.ts`**: `extractSubtitles(videoPath, ffmpegPath, outputDir)` 추가.
   - 명령: `ffmpeg -i <video> -map 0:s:0 -c:s webvtt <out>.vtt`
   - `createVideoFromNonVideo` 의 `conversionQueue` + `shouldUseExistingConversion` 패턴을 그대로 재사용(재추출 방지).
   - 자막 스트림이 없으면 ffmpeg가 실패하므로, **에러를 정상 경로로 흡수**하고 빈 문자열 반환.
2. **`src-electron/main/ipc.ts`**: `createVideoFromNonVideo` 등록부(363행) 옆에 IPC 채널 추가.
3. **`src/types/electron.d.ts`**: `electronApi` 타입에 시그니처 추가 (68-73행 `createVideoFromNonVideo` 참고).
4. **`src/helpers/jw-media.ts`** `addToAdditionMediaMapFromPath()`: 영상이면 추출 시도 → 성공 시 `subtitlesUrl` 채움. 실패해도 미디어 추가 자체는 계속 진행.
5. **`src/components/media/SubtitlesButton.vue`**: 현재 항목에 자막이 실제로 있는지 반영해 버튼 비활성/숨김 처리 (선택 사항이지만 UX상 권장).

## 5. 구현 시 주의사항 / 미해결 질문

1. **ffprobe 바이너리가 없습니다.** [src/helpers/fs.ts:418-426](../src/helpers/fs.ts#L418-L426) `getValidVersion()` 이 릴리스 asset 중 이름에 `ffmpeg` 가 포함된 것만 고릅니다. 따라서 fluent-ffmpeg의 `ffprobe()` 로 자막 스트림 존재를 미리 검사할 수 없습니다. 선택지:
   - (권장) 검사 없이 추출을 시도하고 실패를 정상 처리
   - `ffmpeg -i` 의 stderr 출력에서 `Stream #0:x: Subtitle:` 파싱
   - `getValidVersion()` 을 확장해 ffprobe도 함께 다운로드 (다운로드 용량/시간 증가)
2. **ffbinaries 빌드의 webvtt 먹서 지원 여부**를 실제로 확인해야 합니다. 미지원이면 `-c:s srt` 로 뽑고 해결안 A의 SRT→VTT 변환기를 재사용.
3. **비트맵 자막**(DVD/Blu-ray의 `dvd_subtitle`, `hdmv_pgs_subtitle`)은 텍스트로 변환 불가(OCR 필요) → 명시적으로 미지원 처리하고 사용자에게 안내.
4. **다중 자막 트랙**: 일단 첫 번째(`0:s:0`)만. 언어 선택 UI는 후속 과제. 기존 `langSubtitles` 설정([src/helpers/fs.ts:276](../src/helpers/fs.ts#L276))과의 연계 고려.
5. **`getMetadataFromMediaPath()`**([src/utils/media.ts:203](../src/utils/media.ts#L203))는 music-metadata 기반이라 자막 스트림 정보를 주지 않습니다. 여기에 기대지 말 것.
6. **성능**: 추출은 파일 I/O를 동반하므로 미디어 추가 시 UI를 블로킹하지 않도록 할 것. 썸네일 생성과 동일한 비동기 패턴을 따를 것.
7. **캐시 정리**: [src/helpers/cleanup.ts:92](../src/helpers/cleanup.ts#L92) 가 `subtitlesUrl` 을 다루고 있으므로, 새로 생성한 VTT 캐시 파일이 정리 대상에 포함되는지 확인.
8. **마이그레이션 불필요**: 기존 저장 데이터에 `subtitlesUrl` 이 없어도 `?? ''` 로 처리되므로 스키마 마이그레이션은 필요 없습니다.

## 6. 검증 방법

1. 내장 소프트 자막이 있는 MP4/MKV 준비 (없으면 생성:
   `ffmpeg -i in.mp4 -i sub.srt -c copy -c:s mov_text out.mp4`)
2. 하드섭 영상, 자막 없는 영상, 사이드카 SRT가 있는 영상도 각각 준비.
3. 각각을 수동으로 Library에 추가 → 재생 → 자막 버튼 토글 동작 확인.
4. JW.org 자동 추가 영상의 자막이 **여전히 정상 동작**하는지 회귀 확인(`getSubtitlesUrl` 을 건드리는 경우 필수).
5. 자막 없는 영상 추가 시 Sentry에 에러가 보고되지 않는지 확인(정상 경로로 흡수되어야 함).

## 7. 예상 변경 파일

| 파일                                       | 변경 내용                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src-electron/main/ffmpeg.ts`              | `extractSubtitles()` 신규                                                                                            |
| `src-electron/main/ipc.ts`                 | IPC 채널 등록                                                                                                        |
| `src/types/electron.d.ts`                  | `electronApi` 타입 추가                                                                                              |
| `src/helpers/fs.ts`                        | 사이드카 탐색 + SRT→VTT 변환 헬퍼                                                                                    |
| `src/helpers/jw-media.ts`                  | `addToAdditionMediaMapFromPath()` 에 `subtitlesUrl` 채우기                                                           |
| `src/components/media/SubtitlesButton.vue` | (선택) 자막 없는 항목에서 버튼 비활성화                                                                              |
| `src/i18n/en.json`, `ko.json`              | (선택) 미지원 자막 안내 문구                                                                                         |
| `test/`                                    | `extractSubtitles` 단위 테스트 (기존 `src-electron/main/__tests__/ffmpeg.test.ts` 의 fluent-ffmpeg 모킹 패턴 재사용) |
