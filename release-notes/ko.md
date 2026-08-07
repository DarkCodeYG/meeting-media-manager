<!-- markdownlint-disable no-duplicate-heading -->

# 업데이트 내역

버전별 전체 변경 사항은, GitHub 의 CHANGELOG.md 파일을 확인해주세요.

## v26.4.7-custom.8

### 🐞 버그 수정

- 🐞 **영상 출처에 따라 자막 위치가 달라지던 문제**: JW 가 배포하는 자막 파일은 **모든 자막 줄에 표시 위치가 지정**되어 있어 화면 아래쪽에서 살짝 위에 놓입니다. 반면 앱이 직접 만든 자막(영상 안에서 꺼낸 것, 또는 옆에 있는 `.srt` 를 변환한 것)에는 위치 지정이 없어 재생기 기본값인 **맨 아래**에 붙었습니다. 그래서 한 집회 안에서 출처가 섞이면 자막이 위아래로 튀었습니다. 이제 앱이 만드는 자막에도 JW 와 같은 위치를 넣습니다. 이미 위치가 지정된 자막은 건드리지 않습니다 — 그 위치는 자막을 만든 사람의 의도이기 때문입니다.

- 🐞 **회중 검색이 실패하면 앱이 멈춰 있던 문제**: 검색 결과를 선택했는데 집회 정보가 오지 않으면 내부 상태가 걸린 채로 남았습니다. 창은 아무 설명 없이 그대로 있어 검색이 또 고장난 것처럼 보였고, 그 상태에서는 **회중 이름을 직접 수정해도 수정으로 인식되지 않아** 다음 자동 동기화가 덮어썼습니다. 이제 무슨 일이 있었는지 알려주며, 서버 응답에 필요한 값이 빠져 있어도 견딥니다. 언어 목록을 못 받아왔을 때 남은 세션 동안 언어 조회가 계속 실패하던 문제도 함께 고쳤습니다.

- 🐞 **그래픽 오류 복구가 반복 재시작하던 문제**: custom.2 에 넣은 자동 재시작이 세션 안에서만 횟수를 세고 재시작하면 초기화되어, 하드웨어 가속을 꺼도 그래픽 오류가 계속 나는 환경(드라이버 문제, 가상 머신, 원격 데스크톱)에서는 **매번 재시작**했습니다. 이제 가속이 켜진 상태로 시작한 세션에서만 재시작합니다 — 재시작으로 상황이 달라지는 경우가 그것뿐입니다.

- 🐞 **미디어 미리보기 크기를 조절한 뒤 첫 클릭이 먹지 않던 문제**: 크기 조절을 클릭으로 오인하지 않으려는 처리가 해제되지 않아 다음 클릭을 대신 삼켰습니다.

## v26.4.7-custom.7

### 🐞 버그 수정

두 건 모두 custom.6 에 보고해 주신 자막 문제입니다. **custom.6 의 수정으로는 해결되지 않았습니다** — 그때 고친 부분도 실제 결함이었지만, 보고된 파일은 이미 영상이 내려받아진 상태여서 그 지점을 통과하고 **그 다음 단계에서 막혔습니다.** 원인이 서로 다른 두 가지였습니다.

- 🐞 **JW 서버 목록에 없는 발행물의 자막을 찾지 못하던 문제**: 앱이 자막을 JW 의 두 미디어 서버 중 **한쪽에서만** 찾고 있었는데, `.jwpub` 에 담긴 **미디어 목록형 발행물**(예: `S-418mp`)은 그쪽에 등록되어 있지 않습니다. 자막은 다른 쪽 서버에 정상적으로 있었습니다. 여기에 더해 두 번째 서버 응답의 자막 주소가 내부 타입에 아예 선언되어 있지 않아, 찾아본다 해도 읽을 수 없는 상태였습니다. 이제 첫 번째 서버에 없는 발행물만 두 번째 서버에서 찾습니다.

- 🐞 **긴 영상을 추가한 직후 재생하면 자막이 안 나오던 문제**: 영상 파일 안에 들어 있는 자막을 꺼내는 작업은 파일 전체를 처리하므로 긴 영상은 수 분이 걸리고, 재생은 그것을 기다리지 않습니다. **꺼내기가 끝나기 전에 재생을 시작하면 그 재생 내내 자막이 나오지 않았고, 이유를 알 수 있는 표시도 없었습니다.** 이제 꺼내기가 끝나면 재생 중인 영상에 바로 전달됩니다. **이전에 추가해 둔 영상은 자막이 이미 저장되어 있으니 다시 재생하시면 나옵니다.**

### 참고

재생 중에 붙은 자막이 화면에 즉시 표시되는지는 확인하지 못했습니다. 즉시 표시되지 않더라도 **다시 재생하면 확실히 나옵니다.**

## v26.4.7-custom.6

### 🐞 버그 수정

- 🐞 **`.jwpub` 안의 영상에 자막이 나오지 않던 문제**: `S-418mp-26_CHS_002.jwpub` 같은 파일을 드래그해 넣으면 JW Library 에서는 자막이 나오는데 M³ 에서는 안 나왔습니다. 자막을 찾는 코드가 **파일 경로**로 영상 여부를 판단했지만, 이런 publication 에서는 **영상의 파일 경로가 미리보기 이미지**입니다(데이터베이스가 둘을 연결하고 이미지 경로를 영상 쪽에 복사합니다). 그래서 자막 조회가 아예 시도되지 않았습니다 — 서버에는 자막이 있었습니다. 이제 호출하는 쪽과 같은 방식으로 판단합니다. 보고해 주신 실제 파일과 서버 응답으로 확인했습니다.

- 🐞 **초기 설정 이후에는 병음 노래 토글을 켤 수 없던 문제**: **병음 노래 우선 재생** 설정이 숨겨져 있어서, 이것을 켜는 코드가 **초기 설정 마법사의 한 단계뿐**이었습니다. 그 단계는 직전 단계를 넘어가는 시점에 언어가 이미 중국어 간체여야 나타납니다. 그 단계를 놓치면 설정에서 병음 노래 폴더를 지정해도 **아무 일도 일어나지 않고**, 프로필을 지우지 않는 한 되돌릴 방법이 없었습니다. 이제 중국어 간체 회중에서 폴더 설정 옆에 함께 표시됩니다. 다른 언어에는 변화가 없습니다.

### 함께 보고되었으나 아직 해결되지 않은 것

- **최초 설정 직후 연표어가 표시되지 않는 문제**: **앱을 완전히 종료하고 다시 실행**하면 표시됩니다. v26.4.7-custom.0 에서도 재현되므로 최근 회중 검색 작업으로 생긴 문제가 아닙니다. 원인은 아직 규명하지 못했고 코드를 수정하지 않았습니다.

### custom.2 로 집회 요일이 밀린 경우 (custom.5 안내 보완)

custom.5 안내에서 "회중 이름을 수정한 경우 요일을 직접 지정해야 한다"고 했는데, **더 나은 방법이 있습니다.** 설정 → 회중 집회에 **"일정 동기화 활성화"** 버튼이 있고, 이 버튼은 바로 그 경우에만 나타납니다. 이 버튼으로 회중을 다시 선택하면 요일이 올바르게 저장되고 자동 동기화도 함께 복구됩니다.

## v26.4.7-custom.5

### 🐞 버그 수정

- 🐞 **집회 요일이 하루씩 밀려 저장되던 문제**: custom.2에서 생긴 문제입니다. 서버는 요일을 **일요일부터** 세고 앱은 **월요일부터** 세는데, 검색이 이 차이를 보정하지 못했습니다. 목요일·일요일에 모이는 회중이 **금요일·월요일**로 저장되고 미디어 달력도 그대로 따라갔습니다 — 주말집회 항목이 월요일에, 주중집회 항목이 금요일에 생성되었습니다. 사전집회 시계도 같은 설정을 읽으므로 하루 어긋났습니다.

  **이미 저장된 요일은 자동으로 고쳐지지 않는 경우가 있습니다.** 자동 일정 업데이트가 켜져 있고 회중 이름을 직접 수정하지 않았다면 다음 동기화에서 바로잡힙니다. 그렇지 않다면 — **회중 이름을 수정한 경우 "집회 일정 새로 고침" 버튼으로도 되지 않습니다** — **설정 → 회중 집회에서 두 집회 요일을 직접 지정**해 주십시오.

### 함께 보고되었으나 버그가 아니었던 것

두 건 모두 조사했고 코드 수정이 필요하지 않았습니다.

- **공개강연 연제 입력 카드가 안 보인 문제**: **설정의 "공개 강연 제목" 항목이 꺼져 있었습니다.** 이 항목이 꺼져 있으면 다른 조건과 무관하게 카드가 표시되지 않습니다. 위의 요일 밀림도 실제 주말집회 날짜에서 카드를 가렸겠지만, 이번 경우의 실제 원인은 아니었습니다.
- **연표어가 표시되지 않던 문제**: **앱을 완전히 종료하고 다시 실행**하면 해소됩니다. 실제 프로필 사본으로 확인한 결과 저장된 중국어 연표어가 정상이고 새로 실행한 미디어 창에서 제대로 표시되었습니다. 언어가 잘못되어 있던 동안 영어 연표어만 받아왔는데, 그 뒤 실행 중이던 창이 중국어 연표어를 왜 받아가지 못했는지는 규명하지 못했습니다.

## v26.4.7-custom.4

### 🐞 버그 수정

- 🐞 **회중 검색이 설정된 언어를 바꿔버리던 문제**: custom.2에서 생긴 문제입니다. 집회 언어가 앱의 언어 목록과 맞지 않으면 검색이 언어를 **영어로 바꿔버렸습니다.** 중국어 회중이 이에 해당했고(집회 언어가 구어 코드로 표기됨), 그 결과 **연표어가 표시되지 않고 병음 노래 토글 버튼도 사라졌습니다.** 이제 언어를 확실히 알아낸 경우에만 변경하며, 중국어 구어 코드를 간체 문자로 올바르게 연결합니다. 언어가 바뀌어 있다면 **설정에서 다시 지정**해 주십시오 — 그 설정 외에 영향받은 것은 없습니다.

## v26.4.7-custom.3

### ✨ 새로운 기능

- ✨ **미디어 미리보기**: 재생 중인 미디어 창의 화면을 하단 조작 영역 위에 작은 창으로 보여줍니다. 두 번째 화면을 보지 않고도 무엇이 표시되고 있는지 확인할 수 있습니다. **기본값은 꺼져 있습니다** — 미리보기는 재생과 별도로 화면을 한 번 더 처리하므로 컴퓨터에 부담이 됩니다. **설정 → 미디어 검색 및 재생**, 또는 **화면 팝업의 토글**에서 켤 수 있습니다.

## v26.4.7-custom.2

### 🐞 버그 수정

업스트림이 이미 고쳐둔 수정들을 반영하였습니다.

- 🐞 **회중 검색**: 회중 이름으로 검색해도 집회 시간을 가져오지 못하던 문제를 수정하였습니다. 앱 코드가 아니라 **JW 측 서버 주소가 2026년 5월 초에 변경**된 것이 원인이었습니다. 참고로 이 변경으로 검색 목록에서는 집회 시간 미리보기가 사라지고 회중 번호가 표시되며, 중국어 등 일부 언어는 자동 선택되지 않아 직접 지정해야 할 수 있습니다.
- 🐞 **미디어가 오늘 날짜로 합쳐지던 문제**: 내부 데이터 변환 과정에서 날짜 정보가 손상되어, 특정 날짜의 미디어가 오늘 날짜로 옮겨지던 문제를 수정하였습니다.
- 🐞 **캐시 정리가 직접 추가한 미디어를 삭제**: 미디어를 불러오는 중에 캐시 정리가 실행되면, 앞으로 예정된 집회를 위해 직접 추가해 둔 미디어를 사용하지 않는 파일로 판단해 지우던 문제를 수정하였습니다.
- 🐞 **그림이 일부만 표시되던 문제**: 파수대 연구 기사 등에서 한 세트로 묶인 삽화가 여러 개 있을 때 첫 장만 표시되고 나머지가 사라지던 문제를 수정하였습니다.
- 🐞 **삭제된 미디어를 다시 받지 않던 문제**: 내려받은 파일을 삭제해도 앱이 그대로 있는 것으로 판단해 다시 받지 않던 문제를 수정하였습니다.
- 🐞 **그래픽 오류 복구**: 그래픽 처리 오류가 반복될 때 앱이 예기치 않게 종료되는 대신, 하드웨어 가속을 끈 상태로 스스로 재시작하도록 개선하였습니다.

## v26.4.7-custom.1

### 🐞 버그 수정

- 🐞 **수동 추가 영상의 자막**: 직접 추가한 영상에 자막이 들어 있어도 표시되지 않던 문제를 수정하였습니다. 영상 옆에 있는 `.vtt`/`.srt` 자막 파일을 인식하며, 그런 파일이 없으면 영상 안에 내장된 자막을 꺼내어 표시합니다. 지금까지는 JW.org에서 자동으로 받은 미디어만 자막이 나왔습니다.
- 🐞 **재생 성능**: 영상을 재생할 때마다 매 프레임 도는 루프가 하나씩 쌓여 모임이 진행될수록 CPU 사용량이 늘고 재생이 버벅이던 문제를 수정하였습니다. 재생이 멈춘 영상은 더 이상 자원을 쓰지 않습니다.
- 🐞 **타이머 창 동기화**: 메인 창을 이동해도 타이머 창이 따라오지 않던 문제를 수정하였습니다. 이전 버전에서 추가되었다고 안내한 기능이나 실제로는 연결되어 있지 않았습니다.
- 🐞 **파수대 그림 미디어**: 노래책이 설정되지 않은 경우 파수대 그림이 미디어 목록에서 누락될 수 있던 문제를 수정하였습니다.
- 🐞 **창 이동 반응성**: 창을 드래그하는 동안 불필요한 작업이 반복되던 문제를 개선하였습니다.

### 🔒 보안

- 🔒 **JWPUB / 압축 파일 처리**: 조작된 압축 파일이 지정된 폴더 밖에 파일을 쓸 수 있던 경로 탈출 취약점(Zip Slip)을 차단하였습니다.
- 🔒 **데이터베이스 조회**: 발행물 데이터 조회 쿼리를 파라미터 바인딩으로 변경하여 SQL 인젝션 가능성을 제거하였습니다.
- 🔒 **신뢰 도메인 검사**: `evil-jw.org` 처럼 신뢰 도메인으로 끝나기만 하는 유사 도메인이 신뢰된 것으로 처리되던 문제를 수정하였습니다. 화면 이동, 외부 링크 열기, 권한 요청, 요청 헤더에 모두 영향이 있었습니다.

### 🔧 기타

- 🔧 **번역**: 사용되지 않던 번역 키를 정리하고 중복된 키를 제거하였습니다.
- 🔧 **테스트**: 자막 추출과 보안 수정에 대한 테스트를 추가하고, 특정 시간대에서만 실패하던 테스트를 수정하였습니다.

## v26.4.3-custom.0

### 🛠️ 버그 수정 및 개선

- 🛠️ **업스트림 동기화**: 업스트림 v26.4.3-beta.2까지의 변경사항을 반영하였습니다.
- 🛠️ **창 안정성 개선**: BrowserWindow가 소멸된 후 상태 업데이트 시 발생하던 오류를 수정하였습니다.
- 🛠️ **미디어 창 위치 개선**: 창 위치 설정 시 유효하지 않은 좌표로 인한 오류를 방지하는 경계값 검증을 추가하였습니다.
- 🛠️ **타이머 창 동기화**: 메인 창을 이동할 때 타이머 창 위치도 함께 동기화되도록 개선하였습니다.
- 📦 **의존성 업데이트**: lodash 보안 업데이트(4.18.1), Vue 3.5.32, Electron 41.1.1 등 패키지 업데이트를 반영하였습니다.

## v26.4.0

### ✨ 새로운 기능

- ✨ **Meeting Timer**: A new meeting timer feature has been added. It is optional and can be enabled in the advanced settings, if desired. The timer can be used to allow the media operator to keep track of the time spent on meeting parts, or to display the time spent on the current meeting part on a dedicated screen visible only to the speaker.

## v26.3.0

### ✨ 새로운 기능

- ✨ **Memorial Media**: Automatic Memorial media retrieval is now out of beta! The app will automatically download the Memorial Welcome Video and image to display during the Memorial, when available in the configured language.
- ✨ **Playback Speed**: Added playback speed control with visual indicator, and manual reset. This feature is only visible if enabled in the advanced settings.
- ✨ **Pinyin Songs**: Added a toggle for pinyin song substitution for meetings held in Chinese.

## v26.2.0

### ✨ 새로운 기능

- ✨ **Disk Space Check**: Added functionality to monitor and notify when disk space is low.

## v26.1.5

### ✨ 새로운 기능

- ✨ **기념식 미디어**: 기념식 날짜를 선택하면 지원되는 언어의 기념식 배너와 소개 영상을 자동으로 가져옵니다.

## v26.1.0

### ✨ 새로운 기능

- ✨ **집회 일정 자동 동기화**: 공식 웹사이트의 정보와 집회 날짜 및 시간을 자동 동기화하는 기능을 추가했습니다. 이 기능은 기본적으로 활성화되며, 고급 설정에서 수동 실행하거나 비활성화할 수 있습니다.
- ✨ **향후 일정 변경 반영**: 웹사이트 조회로 회중을 생성할 때 가능한 경우 향후 일정 변경사항도 포함됩니다.
- ✨ **시스템 전체 설치용 공유 캐시**: 시스템 전체 설치에서는 기본적으로 공통 데이터 폴더를 공유하여 같은 컴퓨터의 여러 사용자 간 저장공간과 대역폭 사용을 최적화합니다.

## v25.12.2

### ✨ 새로운 기능

- ✨ **Zoom/Pan buttons**: Added the ability to press and hold zoom and pan buttons for continuous adjustment.

## v25.12.0

### ✨ 새로운 기능

- ✨ **Multi-Select Context Menu**: Added support for right-click menu actions when multiple media items are selected.
- ✨ **Keyboard Shortcuts**: Added `Ctrl/Cmd+A` to select all media, `H` to hide selected media, and `Shift+Up/Down` for keyboard selection navigation.
- ✨ **워치타워 연구 비디오 설정**: 추가 워치타워 연구 비디오를 제외하는 설정을 추가했습니다.
- ✨ **섹션 접기 기능**: 집회가 없는 날에는 섹션을 접어 더 깔끔하게 볼 수 있습니다.
- ✨ **JW Events 웹사이트**: 기본 공식 웹사이트 외에 JW Events 웹사이트도 표시할 수 있습니다.
- ✨ **Playlist Import Customization**: Allowed ability to customize the prefix that is added to media items when importing JW playlists.
- ✨ **웹사이트 미러링 탐색**: 웹사이트 미러링을 중지한 뒤 자동으로 미디어 목록으로 이동하는 토글을 추가했습니다.
- ✨ **OBS 녹화 제어**: OBS 녹화를 제어하는 기능을 추가했습니다.
- ✨ **연표어 미리보기**: 매년 12월부터 다음 해 연표어를 미리 볼 수 있는 기능을 추가했습니다.
- ✨ **업데이트 알림**: 베타 버전 사용 중이거나 업데이트가 비활성화된 경우 경고 알림을 추가하고, 업데이트 다운로드 진행 표시를 개선했습니다.
- ✨ **하드웨어 가속 설정**: 필요할 때 하드웨어 가속을 영구적으로 비활성화하는 옵션을 추가했습니다.

## v25.11.0

### ✨ 새로운 기능

- ✨ **JWPUB 미디어 선택**: JWPUB 파일에서 개별 미디어를 선택할 수 있는 방법을 추가했습니다.
- ✨ **미디어 창 자동 포커스**: Zoom 화면 공유 후 미디어 창에 자동으로 포커스를 맞추는 선택 설정을 추가했습니다.
- ✨ **Cursor Overlay for TV Display**: Enhanced website window cursor overlay for better visibility of the mouse cursor on TV displays.
- ✨ **집회 녹화**: 외부 녹화 앱을 제어하는 새로운 집회 녹화 기능을 추가했습니다.
- ✨ **사이트 검색**: 스마트 검색으로 사이트에서 미디어나 출판물을 찾는 기능을 추가했습니다.
- ✨ **간편 수동 출판물 가져오기**: 잡지, 서적, 프로그램, 초대장 등 JW.org 출판물을 쉽게 가져오는 기능을 추가했습니다.
- ✨ **수어 개선**: 수어 파일 전체 재생 전에 확인을 추가하고, 여러 문단을 연속으로 읽을 때처럼 여러 클립을 선택하는 기능을 지원합니다.
- ✨ **클립 탐색**: 클립 목록 항목에 재생 시간을 표시하고 클립 탐색을 개선했습니다.
- 🛠️ **Media Display**: Ensured media display becomes visible when playback starts, even if it was hidden before.

## v25.10.1

### ✨ 새로운 기능

- ✨ **Setup Wizard – Zoom Step**: Added a Zoom integration step to the setup wizard for easier initial configuration.
- ✨ **Screen Picker Enhancements**: Show an accurate visual representation of all screens, as well as the main window’s current size and location, in the display popup. This makes it easier to choose the correct screen on which the media window should be displayed.
- ✨ **Media Window Preference**: The app will now remember the preferred screen on which the media window should be displayed, if specified by the user.

## v25.10.0

### ✨ 새로운 기능

- ✨ **Begin Playback Paused**: Added a new setting to allow playback to begin paused, which can be useful for AV operators to prepare their setup (such as starting Zoom sharing) before the media starts playing in the media window.
- ✨ **Update Notifications**: Users will now be notified of updates through an in-app banner, which will also allow the user to install updates immediately, instead of waiting for the next app restart.
- ✨ **Custom Events**: Added optional events hooks that can trigger keyboard shortcuts when certain events are detected. This can be useful for AV operators to execute actions automatically outside of the app. For example, smart lights could be turned on and off before and after media plays in auditoriums where projectors are used; or a script can be called after a meeting's last song has been played to automate various actions in a Zoom meeting.

## v25.9.1

### ✨ 새로운 기능

- ✨ **Media Window Always on Top & Fullscreen Behavior**: Fixed and improved always-on-top behavior for the media window, adjusting dynamically based on fullscreen state.
- ✨ **Date Display Format Setting**: Added a user setting to configure a date display format.
- ✨ **Media Crossfade**: Implemented crossfade transitions for media display, instead of the more abrupt fade-to-black transition that was present before.
- ✨ **Music Auto-Stop**: Optimized the behavior of the background music auto-stop to behave the same whether music was auto-started or not
- ✨ **macOS Click-Through on Inactive Windows**: Enabled mouse click passthrough on the main window for macOS, which should make it easier to control the app even when it's not focused.

## v25.9.0

### ✨ 새로운 기능

- ✨ **Download Popup Enhancements**: Added refresh button and download grouping by date in the download popup.
- ✨ **Watched Media Order Memory**: Added section order memory for watched media items.

## v25.8.3

### ✨ 새로운 기능

- ✨ **Media Window Fade Transitions**: Added a new advanced setting to make the media window fade in and out, providing smoother visual transitions.
- ✨ **Image Duration Control and Progress Tracking**: Added image duration control and progress tracking capabilities for repeated sections.

## v25.8.1

### ✨ 새로운 기능

- ✨ **Custom Media Sections**: Complete system for creating, editing, and managing custom media sections with color customization and drag-and-drop reordering.
- ✨ **Media Dividers**: Add titled dividers within media lists for better organization with top/bottom positioning options.
- ✨ **Section Repeat Mode**: Enable continuous playback within specific sections for seamless media loops.
- ✨ **Zoom Integration**: Automatic screen sharing start/stop coordination with media playback.

## v25.7.0

### ✨ 새로운 기능

- No new features for this release!

## 25.6.0

### ✨ 새로운 기능

- ✨ **Metered connection setting**: Added a new setting to reduce download bandwidth usage on metered connections.
- ✨ **Improved streamed media handling**: Better support for streamed media, reducing latency-related issues.

## 25.5.0

### ✨ 새로운 기능

- 🖼️ **OBS Delay Option for Images**: Add an OBS Studio setting to delay scene changes when displaying images, improving transitions.
- 🔊 **Support for `.m4a` Audio Format**: Add compatibility for `.m4a` audio files to expand supported media types.

## 25.4.0

### ✨ 새로운 기능

- 🇵🇭 **New Language: Tagalog**: Added support for Tagalog, expanding the app's multilingual capabilities.
- 🎞 **Support for `.m4v` Video Format**: Now supports playback of `.m4v` files to improve media compatibility.

## 25.3.1

### ✨ 새로운 기능

- 🌏 **새 언어 지원: 한국어**: 안녕하세요! 더 많은 사용자가 쉽게 사용할 수 있도록 한국어 지원을 추가하였습니다.

## 25.3.0

### ✨ 새로운 기능

- 🎵 **동영상 재생 중 배경 음악 재생**: 동영상을 재생중일 때에도 배경 음악을 계속 재생하도록 하였습니다.
- 🎥 **수어 미디어를 위한 카메라 화면 표시**: 수어 사용자를 위해 미디어가 재생중일 때에도 카메라 화면을 표시할 수 있는 기능을 추가하였습니다.
- 📅 **기념식 배경 화면 자동 적용**: 기념식 일자를 자동으로 확인해 당일 기념식 배경 화면을 자동 적용하도록 하였습니다.
- 📜 **애플리케이션 내 업데이트 내역 표시**: 애플리케이션 내에 업데이트 내역을 바로 표시하여 사용자가 변경사항을 쉽게 확인할 수 있도록 하였습니다.

## 25.2.1

### ✨ 새로운 기능

- 🔄 **Allow OBS Reconnection Attempts**: Introduce the possibility to manually force OBS to reconnect when needed.
- 🗑 **Auto Cleanup Old Export Date Folders**: Automatically remove outdated export date folders to keep storage organized.

## 25.2.0

### ✨ 새로운 기능

- 🌍 **Use System Locale by Default**: Automatically detect and use the system's locale for a more personalized experience.
- 🏷 **Tag Support for Exported Media**: Add metadata tags to exported media files for better organization.
- 🔄 **Automatic Beta to Stable Downgrade**: Allow automatic downgrades from beta versions to stable releases when necessary.
- 🌐 **Extract Latest MEPS Language Indexes**: Fetch the most recent MEPS language indexes directly from the official website, ensuring up-to-date language support.

## 25.1.0

### ✨ 새로운 기능

- 📅 **Open Previous Dates**: Allow opening previous dates of the current week, which is useful when the meeting day is moved later in the week.
- 🛑 **Error Banner for OBS Studio**: Add an error banner when OBS Studio is not connected on a meeting day, ensuring users are alerted.
- 📚 **Group Media by Publication**: Group media from the same referred publication for a cleaner and more organized media overview.
- 🎵 **Duplicate Song Warning**: Show a warning if songs are listed more than once in the media list for weekend meetings.
- 🔄 **Future Schedule Planning**: Enable the planning of future meeting schedule changes, which is useful for yearly schedule changes or for the circuit overseer's visit to a neighboring congregation.

## 24.11.0

### ✨ 새로운 기능

- **feat**: Presenting the website is now supported on macOS 🚀
- **feat**: Introduced keyboard shortcuts for stopping, pausing, and resuming media playback 🚀
- **feat**: Added support for setting the web address from which media should be downloaded 🚀
- **feat**: Added OBS Studio instant scene picker and overhauled scene picker functionality in settings
- **feat**: Expanded documentation website to support more languages

## 24.10.10

### ✨ 새로운 기능

- **new**: Added keyboard shortcuts to navigate to the next/previous media item
- **new**: Added a right-click menu to media items to hide media items and rename them
- **new**: Trimmed video times are now respected in imported JWL playlists

## 24.10.9

### ✨ 새로운 기능

- **feat**: Added an option to delete all extra media files for the currently selected day
