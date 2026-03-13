# CLAUDE.md — meeting-media-manager 프로젝트 규칙

## 프로젝트 개요

- **앱**: Meeting Media Manager (M³) — 여호와의 증인 회중 모임용 미디어 관리 Electron 앱
- **기술 스택**: Electron + Vue 3 + Quasar 2 + TypeScript + Yarn 4
- **빌드 대상**: Production only (`yarn build`). `yarn dev`는 ESM/CJS 호환 문제로 사용 불가
- **출력물**: `dist/electron/Packaged/meeting-media-manager-*.dmg`

## 작업 규칙 (반드시 준수)

### 1. 질문과 요청을 구분하라

- "~할 수 있니?", "~가능해?" 같은 질문에는 **가능 여부만 답변**하라. 바로 구현하지 마라.
- "~해줘", "~구현해줘", "~만들어줘" 같은 명시적 요청이 있을 때만 구현을 시작하라.
- 애매한 경우 반드시 먼저 물어보라: "구현을 진행할까요?"

### 2. 계획 먼저, 승인 후 구현

- 코드 변경이 필요한 작업은 **먼저 계획을 제시**하고 승인을 받아라.
- 계획에 포함할 내용:
  - 변경할 파일 목록
  - 각 파일에서 변경할 내용 요약
  - 기존 기능에 미치는 영향
- 사소한 수정(오타, 한 줄 변경 등)은 예외로 바로 진행 가능.

### 3. 구현 후 코드 리뷰

- 구현 완료 후 변경 사항을 **요약하여 리뷰용으로 제시**하라.
- 리뷰 내용:
  - 변경된 파일과 핵심 변경 내용
  - 부작용(side effect) 가능성
  - 테스트 필요 여부

### 4. 기존 코드 존중

- 새 기능 추가 전에 **이미 구현된 기능인지 먼저 확인**하라.
- 기존 코드의 패턴과 컨벤션을 따르라.
- 불필요한 리팩터링, 주석 추가, 타입 어노테이션 추가 금지.

### 5. 한국어 사용

- 사용자와의 대화는 **한국어**로 진행하라.
- 코드와 커밋 메시지는 영어로 작성하라.

## 빌드 방법

```sh
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
yarn install
yarn generate:logos   # 최초 1회 또는 로고 변경 시
yarn build
```

### 빌드 전 확인 사항

- `src-electron/electron-preload.cjs` 파일이 있으면 삭제 (빈 화면 버그 방지)
- 앱이 실행 중이면 `pkill -9 -f "Meeting Media"` 로 종료

### 알려진 빌드 이슈

- 자동 업데이트 코드 서명 오류: 로컬 빌드에서 정상 — 무시해도 됨
- Dev 모드 (`yarn dev`): ESM/CJS 호환 문제로 의도적으로 사용 불가

## 프로젝트 구조 핵심

```
src/                    # Vue 3 프론트엔드
  components/media/     # 미디어 관련 컴포넌트 (MediaList, MediaItem 등)
  pages/                # 페이지 (MediaCalendarPage, MediaPlayerPage 등)
  layouts/              # 레이아웃 (MainLayout)
  stores/               # Pinia 스토어
  helpers/              # 유틸리티/헬퍼
  i18n/                 # 다국어 번역 파일
src-electron/           # Electron 메인 프로세스
  main/                 # 메인 프로세스 코드
    window/             # 윈도우 관리 (main, media)
    shortcuts.ts        # 글로벌 키보드 단축키
quasar.config.ts        # Quasar/빌드 설정 (CJS 포맷 강제 등)
```

## 기술적 참고 사항

- **창 간 통신**: `BroadcastChannel`을 사용 (메인 윈도우 ↔ 미디어 플레이어 윈도우)
- **키보드 단축키**: Electron `globalShortcut` + Mousetrap (로컬) 이중 구조
- **CJS 빌드**: `quasar.config.ts`에서 Electron main/preload를 CJS 포맷으로 강제
- **Yarn 패치**: `@sentry/electron`에 lazy evaluation 패치 적용됨
