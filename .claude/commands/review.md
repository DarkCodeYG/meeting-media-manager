# /review — Electron + Vue 3 코드 리뷰 스킬

이 스킬은 meeting-media-manager 프로젝트의 변경 코드를 체계적으로 리뷰한다.
인자로 파일 경로나 범위를 받을 수 있다. 인자가 없으면 최근 변경된 파일 전체를 리뷰한다.

## 리뷰 체크리스트

다음 항목을 **순서대로** 검토하고, 각 항목에 대해 ✅ (이상 없음) / ⚠️ (경미한 이슈) / ❌ (심각한 이슈) 로 표시한다.

### 1. 기존 동작과의 일관성

- 기존 섹션(pt, circuit-overseer, lac 등)의 동작이 의도치 않게 변경되지 않았는가?
- 새로 추가된 섹션/기능이 기존 섹션과 동일한 패턴(CSS 클래스명, uniqueId 규칙, 이벤트 흐름)을 따르는가?
- `standardSections`, `hasAddMediaButton`, `isSongButton` 등 공통 로직에 새 항목을 추가할 때 기존 항목 전체에 영향이 없는가?

### 2. 회귀 버그 (Regression)

- 기존에 잘 동작하던 기능이 새 코드 경로에서 실패할 가능성은 없는가?
- 조건문 변경 시 기존 케이스가 여전히 올바른 분기로 진입하는가?
- 타입 변경(union type 확장 등) 시 exhaustive check가 누락되지 않았는가?

### 3. 불필요한 코드 수정

- 요청된 기능 범위를 벗어난 리팩터링이 포함되어 있는가?
- 사용되지 않는 import, 변수, 주석이 추가되지 않았는가?
- 디버그용 `console.log`가 잔류하는가?
- 구현 방향이 변경(예: A 방식 → B 방식으로 교체)되었을 때, 이전 방식을 위해 추가했던 코드(타입 선언, 헬퍼 등)가 dead code로 남아 있지 않은가?

### 4. 자체 시뮬레이션 (Logic Simulation)

- 주요 상태 조합(섹션 있음/없음, 노래 있음/없음, 커스텀/표준, 회의 날짜/비회의 날짜)에서 computed 결과가 올바른가?
- `watch`의 immediate 여부, 의존성 배열이 올바른가?
- 비동기 흐름(async/await, Promise)에서 에러 처리가 누락되지 않았는가?
- Electron IPC / BroadcastChannel 이벤트 발신·수신 쌍이 맞는가?

### 5. 더 간단한 해결책 존재 여부

- 같은 결과를 더 적은 코드로 달성할 수 있는가?
- 이미 존재하는 헬퍼/컴포저블을 활용하지 않고 중복 구현한 부분은 없는가?
- 조건 분기를 배열 includes()나 Set으로 단순화할 수 있는가?

### 6. 코딩 컨벤션

- 기존 코드와 동일한 명명 규칙(camelCase 변수, PascalCase 컴포넌트, kebab-case 이벤트)을 따르는가?
- TypeScript 타입 정의 방식(type alias vs interface, union type 확장 위치)이 기존 파일과 일치하는가?
- Vue 3 Composition API 패턴(`computed`, `ref`, `watch` 사용법)이 기존 컴포저블과 동일한가?
- i18n 키 명명 규칙(kebab-case)과 번역 파일 구조가 기존과 일치하는가?
- SCSS 클래스 패턴(`.bg-{id}`, `.text-{id}`, `.media-section.{id}:before`)이 기존 섹션과 동일하게 추가되었는가?

### 7. Electron 특화 사항

- `globalThis.electronApi` 접근 전 null 체크가 되어 있는가?
- 렌더러 프로세스에서 Node.js API를 직접 호출하지 않고 preload를 통해 접근하는가?
- `BroadcastChannel` / `CustomEvent` 사용 시 이벤트 이름 오타 및 payload 타입이 수신측과 일치하는가?
- 창 종료 시 이벤트 리스너가 정리(cleanup)되는가?

## 출력 형식

리뷰 결과는 다음 형식으로 출력한다:

```
## 코드 리뷰: [파일명 또는 기능명]

### 1. 기존 동작과의 일관성 ✅/⚠️/❌
[내용]

### 2. 회귀 버그 ✅/⚠️/❌
[내용]

...

## 총평
[전체 요약 및 개선 권고사항]
```
