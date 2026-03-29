# /merge-upstream — 업스트림 머지 스킬

이 스킬은 포크(DarkCodeYG/meeting-media-manager)를 업스트림(sircharlo/meeting-media-manager)과 동기화한다.
충돌 시 **포크가 항상 이기는** `-X ours` 전략을 사용한다.

## 머지 전략

- `git merge -X ours upstream/master` 사용
- 충돌 파일은 포크 버전이 자동으로 우선
- 업스트림만 수정한 파일은 정상 반영
- 머지 후 충돌 파일의 업스트림 변경 내용을 검토해 중요한 버그픽스가 누락됐는지 확인

## 실행 절차

### 1단계: 업스트림 최신화

```bash
git fetch upstream
git log --oneline master..upstream/master
```

새 커밋 목록을 출력하고 변경 규모를 파악한다.

### 2단계: 충돌 대상 파일 파악

```bash
git diff --name-only master..upstream/master
```

변경된 파일 목록을 확인한다.

### 3단계: 머지 실행

```bash
git merge -X ours upstream/master
```

충돌은 자동으로 포크 버전으로 해결된다.

머지가 fast-forward로 완료되거나 충돌 없이 완료되면 4단계로 넘어간다.

### 4단계: 누락된 업스트림 버그픽스 검토

충돌이 발생한 파일들에 대해 업스트림이 어떤 변경을 했는지 확인한다:

```bash
git diff ORIG_HEAD..upstream/master -- <충돌 발생 파일들>
```

- 포크 기능과 무관한 순수 버그픽스가 있으면 수동으로 포크에 반영한다
- 포크 기능 코드 제거 / 포크 번역 삭제 등은 무시한다

### 5단계: 버전 정보 복원 확인

머지 후 다음 항목이 업스트림 값으로 덮어쓰여졌는지 확인하고, 덮어쓰여졌으면 포크 값으로 복원한다:

```bash
# package.json 확인
grep '"version"\|"url"' package.json
```

- `version`: `26.x.x-custom.x` 형식이어야 함 (업스트림은 `-beta.x`)
- `repository.url`: `https://github.com/DarkCodeYG/meeting-media-manager.git`이어야 함
- `APP_ID` in `quasar.config.ts`: `darkcodeyg.meeting-media-manager`이어야 함

### 6단계: 포크 전용 파일 복원 확인

다음 파일들이 삭제되지 않았는지 확인한다:

```bash
ls .github/workflows/custom-build.yml \
   .yarn/patches/@sentry-electron-npm-7.10.0-e9b4c924be.patch \
   CLAUDE.md \
   LOCAL_BUILD_MACOS.md \
   src/assets/fonts/Orbitron.woff2 \
   src/migrations/remove-legacy-jw-icons-font.ts
```

삭제됐으면 `git checkout ORIG_HEAD -- <파일>` 로 복원한다.

### 7단계: 포크 기능 회귀 버그 코드 리뷰

**커밋 전 반드시 수행.** Explore 에이전트를 사용하여 포크 기능 회귀 테스트를 진행한다.

검증 항목:

1. **설정 정의** (`settings.ts`, `settings.d.ts`) — 포크 설정 전체 존재 + 타입 일치
2. **포크 로직** (`media-sections.ts`, `MainLayout.vue`) — 강연 제목 보존, 베델 연사 섹션, 사전 시계 로직 온전한지
3. **번역 키** (`en.json`, `ko.json`, `cmn-hans.json`) — 포크 전용 번역 키 누락 없는지
4. **타입 속성** (`media.d.ts`) — `publicTalkTitle`, `publicTalkSpeaker` 등 포크 속성 존재
5. **import/변수명** — 업스트림 변경으로 인한 참조 누락, 변수명 불일치 없는지
6. **eslint** — `no-console` 등 린트 규칙 위반 없는지

리뷰 결과를 사용자에게 보고한 후 커밋을 진행한다.

### 8단계: 커밋 & 푸시

```bash
git push
```

## 포크 전용 보호 파일 목록

업스트림이 삭제하거나 덮어써도 **항상 포크 버전을 유지**해야 하는 파일:

| 파일                                 | 이유                                           |
| ------------------------------------ | ---------------------------------------------- |
| `quasar.config.ts`                   | CJS 빌드 설정, `beforePackaging` 훅, `APP_ID`  |
| `package.json` (버전·URL)            | 포크 버전 번호, 리포 URL                       |
| `src/css/app.scss`                   | 포크 전용 CSS (시계, 카운트다운, 강연 제목)    |
| `src/layouts/MainLayout.vue`         | 집회 전 시계, 강연 제목 이벤트 리스너          |
| `src/pages/MediaPlayerPage.vue`      | 시계 UI                                        |
| `src/constants/settings.ts`          | 포크 설정 항목                                 |
| `src/types/settings.d.ts`            | 포크 설정 타입                                 |
| `src/types/media.d.ts`               | `publicTalkTitle`, `service-talk` 등 포크 타입 |
| `src/i18n/ko.json`                   | 한국어 포크 번역                               |
| `src/i18n/cmn-hans.json`             | 중국어 포크 번역                               |
| `src/stores/jw.ts`                   | `yeartextFontOverrides` 등 포크 스토어         |
| `src/migrations/index.ts`            | 포크 마이그레이션 등록                         |
| `.github/workflows/custom-build.yml` | 포크 전용 빌드 워크플로우                      |
| `.yarn/patches/@sentry-*`            | Sentry lazy evaluation 패치                    |
| `CLAUDE.md`                          | 포크 작업 규칙                                 |
| `LOCAL_BUILD_MACOS.md`               | 로컬 빌드 가이드                               |
| `src/assets/fonts/Orbitron.woff2`    | 시계 폰트                                      |

## 주의사항

- `-X ours`는 충돌 구간에서 포크가 이기지만, 충돌이 없는 구간은 업스트림 변경이 그대로 적용된다
- 머지 후 빌드가 깨지면 4단계에서 누락된 업스트림 변경이 포크와 충돌했을 가능성이 높다
- `yarn.lock`이 변경됐으면 `yarn install` 실행 후 lockfile 커밋 필요
