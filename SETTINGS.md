# 다이노 런 - 핵심 설정값 요약

AI(제미나이/클로드 등)와 새로운 채팅을 시작할 때 이 파일을 같이 붙여넣으면
"예전 세팅값을 까먹는" 문제를 줄일 수 있습니다. 값을 바꿀 때마다 여기도 같이 업데이트하세요.

## main.js - 전역 설정
| 항목 | 값 | 위치 |
|---|---|---|
| 캔버스 크기 | 1200 x 675 (16:9) | `main.js` 상단 |
| 시작 속도(baseSpeed) | 2 | `window.gameConfig` |
| 최고 속도(maxSpeed) | 12 | `window.gameConfig` |
| 속도 증가율 | 프레임당 +0.0004 | `gameLoop()` |
| 바닥 Y좌표(groundY) | 560 | `window.gameConfig` |
| 점프 선입력 유효시간 | 150ms | `JUMP_BUFFER_MS` |
| 로딩 타임아웃(신규) | 10000ms | `main.js` |
| 점수 환산(신규) | 10px 이동 = 1M | `main.js`의 `METERS_PER_PIXEL` |
| 최고 기록 저장 위치(신규) | `localStorage['dinoRunBestScore']` | `main.js`의 `BEST_SCORE_STORAGE_KEY` |

> ⚠️ **시행착오 기록(롤백됨)**: 한때 프레임레이트 독립적 물리(델타타임)를 도입해서
> `gameLoop(timestamp)`가 실제 경과시간을 `deltaFactor`로 정규화해 `dino.update(deltaFactor)`
> 등에 전달하고, `apexGravityMultiplier`도 0.1→0.32로 재조정한 적이 있습니다. 하지만
> 사용자가 "애초에 baseSpeed=2를 기준으로 모든 오브젝트 속도를 배수로 조절하던 원래 방식"으로
> 즉시 롤백해달라고 요청해서 **전부 되돌렸습니다**. 현재 `dino.update()`, `obstacle.update()`,
> `background.update()`, `drawGameOverSequence()`는 모두 인자 없이 예전처럼 매 프레임 고정량만큼
> 갱신하는 원래 구조입니다. 이 영역(점프 물리/속도/장애물 생성 간격)은 **사용자가 명시적으로
> 재요청하기 전까지 다시 건드리지 마세요.**

## dino.js - 공룡
| 항목 | 값 |
|---|---|
| 시작 x | 105 |
| 스케일 | 0.25 |
| 기본 중력(gravity) | 0.8 |
| 상승 구간 중력 계수 | x1.4 (빠르게 올라감) |
| 정점 부근 중력 계수 | x0.1 (살짝 머무름, `apexVelocityThreshold`=5) |
| 하강 구간 중력 계수 | x0.55 (천천히, 부드럽게 낙하) |
| 점프 힘 | -15 |
| 히트박스 offset | x:30, y:10 |
| 히트박스 크기 | 50 x 60 |
| 디버그 히트박스 표시 | `window.gameConfig.debugHitbox`(기본 false)만 보고 표시. 홈 화면 설정에서 토글 가능 |

> ⚠️ **시행착오 기록(버그)**: `debugHitbox` 도입 당시 `draw()`가 `this.showHitbox &&
> window.gameConfig.debugHitbox`로 검사했는데, `this.showHitbox`가 생성자에서 항상 `false`로
> 하드코딩되어 있어서 설정에서 히트박스를 켜도 **공룡 히트박스만 절대 표시되지 않는** 버그가
> 있었습니다(장애물은 `gameConfig.debugHitbox`만 보고 있어서 정상 작동). `this.showHitbox`
> 검사와 필드 자체를 제거하고 장애물과 동일하게 `gameConfig.debugHitbox` 하나만 보도록
> 고쳤습니다.

## obstacle.js - 장애물
| 항목 | 값 |
|---|---|
| 지상 장애물 스케일 | 0.45 |
| 공중 장애물 스케일 | 0.26~0.30 (랜덤) |
| 지상 히트박스 | 원본의 90% |
| 공중 히트박스 | 원본의 90% (0번 프레임은 1번 프레임 크기로 고정 후 90%) |
| 공중:지상 등장 비율(수정, 유지됨) | 4:6 (`AIR_OBSTACLE_RATIO = 0.4`) — 웨이브 타입을 먼저 정하고, 지상일 때만 아래 팩 로직 적용 |
| 3연속 배치 조건(지상 웨이브 한정) | speed >= 6, 40% 확률 |
| 2연속 배치 조건(지상 웨이브 한정) | speed >= 4, 50% 확률 |
| 웨이브 생성 간격 | `max(900, max(700, 1100-speed*40)+packBonus / speed) + random(0~300)` (원래 공식, 롤백됨) |

> ⚠️ **시행착오 기록**: 예전에는 공중 장애물이 "단독(팩 아닌) 웨이브일 때만 30% 확률"로만
> 나와서 실제 비율이 훨씬 낮았고(팩이 뜨면 무조건 지상), 사용자가 "그냥 계속 점프만 해도
> 될 정도로 쉽다"고 피드백을 줬습니다. 이제 매 웨이브마다 공중/지상 타입을 4:6으로 먼저
> 정해서 실제 등장 비율을 정확히 맞추고, 팩(2~3개 묶음)은 지상 웨이브에서만 추가로 결정합니다.
> 이 부분(4:6 비율)은 롤백 대상이 아니라서 그대로 유지했습니다.
>
> 웨이브 생성 간격 자체는 한때 "점프~착지 시간" 기준으로 여러 차례 조정했었지만, 최종적으로
> 사용자 요청에 따라 **원래의 `baseSpeed` 배수 기반 공식으로 완전히 롤백**했습니다.

## background.js - 낮/밤 시스템
| 항목 | 값 |
|---|---|
| 낮 하늘색 | rgb(135, 206, 235) |
| 밤 하늘색 | rgb(0, 0, 0) |
| 태양/달 이동 targetX | 1100 |
| 전환 속도(transitionSpeed, 수정) | 9.6 (기존 12에서 20% 감속) |
| 진입 후 감속 시간(settleDurationMs, 신규) | 300ms (ease-out 3차) |
| 천체 이동 속도(celestialSpeedRate, 수정) | baseSpeed * 0.0768 (기존 0.096에서 20% 감속) |
| 최대 암전 정도(darkness) | 0.40 |
| 어둠 필터 공식 (★공용 함수화됨) | `background.getFilterString(intensityMultiplier = 1.5)` |
| 장애물/공룡 전용 어둠 강도(신규) | `getFilterString(1.0)` — 배경(기본 1.5)보다 약하게 어두워짐 |

> ⚠️ **중요**: 어둠 필터(`brightness(...)`)는 이제 `background.getFilterString()` 한 곳에서만
> 계산합니다. `main.js`의 게임 루프와 `gameover.js`의 게임오버 연출 모두 이 함수를 호출해서
> 필터를 적용해야 합니다. 필터 관련 로직을 다시 손볼 때는 **절대 이 함수를 두 번 따로 만들지 마세요**
> (이번에 고친 "게임오버 시 필터 풀리는 버그"의 원인이 바로 이 중복이었습니다).
> **신규**: 달만 원본 색을 유지하고 배경만 어두워지는 것과 비슷하게, 장애물/공룡도 밤에
> 시야 확보를 위해 배경보다 덜 어둡게 해달라는 요청으로 `intensityMultiplier` 인자를
> 추가했습니다. `background.draw()` 내부(배경 레이어)는 인자 없이 기본값(1.5) 그대로 쓰고,
> `main.js`의 게임 루프와 `gameover.js`는 `getFilterString(1.0)`으로 더 약하게 호출합니다.
> 계산 공식은 여전히 이 함수 하나뿐이므로 "여러 곳에 중복 구현" 문제는 재발하지 않습니다.

> ⚠️ **시행착오 기록(버그)**: 무한 스크롤용으로 배경 레이어를 2장씩 이어붙여 그리는데,
> `update()`가 레이어 x좌표를 `-drawWidth` 밑으로 넘어가면(오버슈트) 그 초과분을 버리고
> 그냥 `0`으로 리셋하고 있었습니다. speed가 빠를수록 한 프레임 이동량(오버슈트)도 커져서,
> 리셋 순간 배경이 그만큼 순간 이동하며 검은 틈이 잠깐 보이는 원인이 됐습니다. `x = 0` 대신
> `x += drawWidth`로 바꿔서 초과분을 그대로 이어가도록(나머지 보존) 수정했습니다. 추가로
> `draw()`에서 두 번째 타일을 1px 앞당겨 겹치게 그려서, 소수점 좌표에서 생길 수 있는 서브픽셀
> 반올림 틈도 안전하게 방지했습니다.

## 상태 관리 흐름 (Background.state)
```
day -> sun_phase_out -> moon_phase_in -> moon_settling(0.3초 감속) -> night
     -> moon_phase_out -> sun_phase_in -> sun_settling(0.3초 감속) -> day (반복)
```
> 퇴장(phase_out)은 여전히 transitionSpeed로 즉시 빠르게 나감. 진입(phase_in)만
> targetX 도달 후 곧바로 등속 궤도 속도로 바뀌지 않고, settling 상태에서 0.3초간
> ease-out으로 부드럽게 감속됨.

## 홈 화면 - 설정 / 닉네임 (신규)
| 항목 | 값 |
|---|---|
| 닉네임 저장 위치 | `localStorage['dinoRunNickname']` (추후 랭킹 시스템에서 사용 예정) |
| 설정 버튼 위치 | 홈 화면 좌측 상단(`#homeSettingsBtn`), `toggleSettings()`로 열기/닫기 토글 |
| 설정 항목 | 음악 on/off, 히트박스 표시 on/off, 반전 모드 on/off |
| 랭킹 시스템 | 구현 완료 (아래 "랭킹 시스템(신규, Supabase)" 섹션 참고) |

### 설정 버튼 토글 + 회전 애니메이션 (신규)
`#homeSettingsBtn`의 `onclick`이 `openSettings()`(열기 전용) → `toggleSettings()`로 바뀌어서,
다시 누르면 닫힙니다. `.corner-btn`에 `transition: transform 0.35s ease`를 주고
`#homeScreen.settings-open #homeSettingsBtn { transform: rotate(180deg); }`만 추가했습니다 —
열릴 때 0°→180°(시계방향), 닫힐 때는 같은 트랜지션이 역재생되어 180°→0°(반시계방향)로
자연스럽게 돌아갑니다(JS 애니메이션 없이 CSS만으로 처리).

### 버튼 아이콘 (신규, `assets/setting/`)
이모지 대신 이미지 아이콘으로 교체했습니다. 모두 `.btn-icon` 클래스(기본 버튼 크기의 65%,
`object-fit:contain`, `pointer-events:none`)로 가운데 정렬됩니다.
| 버튼 | 아이콘 파일 |
|---|---|
| 설정(`#homeSettingsBtn`) | `Tribe_Info_Icon-Setting.png` (`#homeSettingsBtn .btn-icon`만 88%로 별도 확대) |
| 홈(`#homeBtn`, `#goHomeBtn`) | `Tribe_WareHouse.png` |
| 재시작(`#restartBtn`, `#retryBtn`) | `Item_Undo.png` |
| 소리(`#soundBtn`, `#settingsSoundBtn`) | `Sound_Off.png`(항상 표시) + `Sound_On.png`(소리 켜졌을 때만 표시, `.sound-on-icon`) |

> 아이콘 크기는 55%(기본) → 65% → **80%**(현재, 홈/재시작 공용 `.btn-icon`)로 커졌고,
> 설정 버튼(`#homeSettingsBtn .btn-icon`)은 80% → 88% → 96%까지 `width`/`height` 퍼센트로
> 키웠습니다. 100%를 넘기려고 115%로 시도했더니, `.corner-btn`이 `aspect-ratio:1/1;
> height:auto;`인 상태에서 자식 이미지의 `height`가 퍼센트로 100%를 넘어가면서 **버튼 자체의
> 높이 계산에 영향을 줘서 동그라미가 타원으로 늘어나는 버그**가 있었습니다. `width`/`height`
> 퍼센트 대신 레이아웃에 전혀 관여하지 않는 `transform: scale(1.15)`(현재)로 바꿔서 해결했습니다
> — 아이콘은 항상 버튼과 같은 100% 크기로 배치된 뒤 순수 시각적으로만 확대되고, 가로세로
> 항상 같은 배율이라 절대 찌그러지지 않습니다. **100%를 넘는 아이콘 확대가 필요하면 항상
> `width`/`height` 대신 `transform: scale()`을 쓰세요.** 재시작 버튼(`#restartBtn`/`#retryBtn`)의
> 버튼 자체 크기(흰 원)를 한때 20% 더 키운 적이 있었지만(`width:6%`), 나중에 "다른 원들과
> 크기를 똑같이" 요청으로 **되돌려서 지금은 홈/소리 버튼과 동일한 5%**입니다. 설정 패널 안의
> 소리 버튼(`#settingsSoundBtn`) 아이콘만 `.settings-panel-content .sound-btn .btn-icon`
> (`height: 1.67cqw`)으로 별도 고정되어 이 확대의 영향을 받지 않습니다.
>
> ⚠️ **시행착오 기록(버그, 수정됨)**: 재시작 버튼만 20% 키웠을 때, `.sub-buttons`에
> `align-items`를 지정 안 해서 기본값(`stretch`)이 적용되어 있었습니다. 그 결과 재시작 버튼이
> 그 줄에서 제일 큰 버튼이 되면서, 홈/소리 버튼까지 재시작 버튼 높이에 맞춰 세로로 늘어나
> 정사각형이 아니라 찌그러진(옆으로 짧아 보이는) 모양이 됐습니다. `.sub-buttons`에
> `align-items: center`를 추가하고 각 버튼에 `flex-shrink: 0`도 더해서, 앞으로 버튼 크기가
> 서로 달라져도 각 버튼이 항상 자기 `aspect-ratio: 1/1`(정사각형)를 그대로 유지하도록
> 고쳤습니다. 이 문제는 재시작 버튼을 다른 버튼과 같은 크기로 되돌리면서 자연히 해소됐지만,
> `align-items: center`/`flex-shrink: 0`는 나중에 다시 어떤 버튼을 다른 크기로 키우더라도
> 안전하도록 그대로 남겨뒀습니다.

소리 버튼은 `.sound-btn` 클래스로 두 이미지를 가로로 나란히 배치합니다. `toggleSound()`는
`document.querySelectorAll('.sound-on-icon')`으로 두 버튼(일시정지 메뉴 + 홈 설정)의 On
아이콘을 한 번에 보이거나 숨깁니다(이모지 innerText 교체 방식은 제거됨).
일시정지/게임오버 화면의 `#pauseBtn`, `#resumeBtn`, `#startBtn`, `#closeSettingsBtn`은
이번 교체 대상이 아니라서 그대로 텍스트/기호를 유지합니다.

> ⚠️ 일시정지 메뉴의 원형 소리 버튼(`#soundBtn`)은 기본 `.sound-btn .btn-icon`(버튼 높이의
> 55%)이 잘 맞았지만, 설정 패널 안의 `#settingsSoundBtn`은 옆의 ON/OFF 텍스트 버튼들에 비해
> 너무 커 보인다는 피드백이 있었습니다. `.settings-panel-content .sound-btn .btn-icon`에
> `height: 20px` 고정값으로 덮어써서 설정 패널 안에서만 작게 표시되도록 했습니다(원형 버튼
> 쪽은 그대로 55% 유지).

### ON 상태 노란색 표시 (신규)
`toggleHitbox()`/`toggleInvert()`가 텍스트("ON"/"OFF") 갱신과 함께 버튼에 `.on` 클래스를
토글합니다. CSS `.setting-row button.on { background-color: #ffd400; }`로 켜짐 상태를
노란색으로 표시합니다. `openSettings()`를 열 때도 현재 상태에 맞게 `.on` 클래스를 다시
동기화합니다. `toggleSound()`도 `.sound-btn` 전체에 `.on`을 토글해서 같은 방식으로 표시하고,
소리는 기본값이 켜짐(`isAudioOn = true`)이라 `#settingsSoundBtn`에 처음부터 `class="sound-btn
on"`을 넣어뒀습니다. `.setting-row button.on` 규칙은 `.setting-row` 안의 버튼에만 적용되므로
일시정지 메뉴의 원형 소리 버튼(`#soundBtn`)에 `.on`이 붙어도 시각적으로는 영향이 없습니다.

### 설정 버튼 고정 너비 (수정)
`.setting-row button`(히트박스/반전/소리 버튼 전부)이 `padding`만 있고 너비가 내용물
("ON"/"OFF" 글자 폭, 소리 아이콘 표시 여부)에 따라 달라져서 토글할 때마다 버튼 가로폭이
미세하게 흔들리는 문제가 있었습니다. `width: 70px` 고정 + `display:flex`로 내용을 가운데
정렬하도록 바꿔서, 내용물이 바뀌어도 버튼 크기 자체는 항상 동일하게 유지됩니다.

> ⚠️ 히트박스 표시를 켜면 설정 화면에 "랭킹에 등록되지 않는다"는 안내 문구가 뜹니다. 이제 랭킹
> 시스템(아래 섹션)이 실제로 만들어져서, `js/leaderboard.js`의 `submitScoreToLeaderboard()`가
> `window.gameConfig.debugHitbox`가 켜져 있으면 제출 자체를 건너뛰도록 강제 연결됐습니다.

### 설정 패널 구조 (수정: 슬라이드 드로어)
`#homeScreen`을 `flex-direction: row`로 바꾸고, `#settingsPanel`(좌측, width 0→30cqw 애니메이션,
불투명 배경)과 `#homeContent`(제목+닉네임+플레이 버튼, `flex:1`)를 형제로 배치했습니다.
`openSettings()`/`closeSettings()`는 `#homeScreen`에 `settings-open` 클래스를 토글할 뿐이고,
실제 너비 애니메이션과 그에 따른 `#homeContent`의 자동 재배치는 CSS(flexbox + `width` 전환)가
전부 처리합니다. 패널 내부(`.settings-panel-content`)는 `cqw`로 고정폭을 줘서 부모의 width
애니메이션 도중 내용이 찌그러지지 않고 "드러나는" 느낌을 줍니다.

> ⚠️ **시행착오 기록**: 원래는 `#settingsOverlay`가 반투명 배경(`rgba(0,0,0,0.5)`)으로 화면 전체를
> 덮는 방식이라 뒤 콘텐츠가 비쳐서 설정 내용이 잘 안 보인다는 피드백을 받았습니다. 지금은
> 불투명한 좌측 드로어 패널로 바꿔서 이 문제가 없습니다.

> ⚠️ **신규**: 설정을 열어둔 채로 플레이해도 다음에 홈으로 돌아왔을 때 여전히 열려있던
> 문제가 있었습니다. `startGameFromHome()` 맨 앞에서 `closeSettings()`를 호출하도록 고쳐서,
> 플레이를 누르면 설정 패널이 항상 닫힌 채로 시작하도록 했습니다.

### 반전 모드 (신규)
`toggleInvert()`가 `isInvertOn`을 토글하고 `#gameCanvas`에 `invert-mode` 클래스를 붙였다 뗍니다.
CSS `#gameCanvas.invert-mode { filter: invert(1); }`로 캔버스 전체를 색상 반전시킵니다. 이건
캔버스 DOM 엘리먼트에 걸리는 CSS `filter`라서, `ctx.filter`로 그리기 도중에만 적용되는
밤/낮 밝기 필터(`background.getFilterString()`)와는 완전히 별개이며 서로 간섭하지 않습니다.

## 점수(거리) 시스템 (신규)
| 항목 | 값 |
|---|---|
| 표시 위치 | 캔버스 우측 상단(`#scoreBoard`): 최고 기록(작게, 위) / 현재 기록(크게, 아래) |
| 증가 로직 | `gameLoop()`에서 매 프레임 `currentScore += baseSpeed * METERS_PER_PIXEL` (죽으면 이 코드에 도달하지 않아 자동 정지) |
| 최고 기록 갱신 시점 | `gameover.js`의 `gameOver()` 호출 시점에 확정 비교/저장 |
| 게임오버 화면 표시 | `#finalScoreText`에 `Math.floor(currentScore)`+"M" 표시 |
| 리셋 시점 | `restartGame()`, `goHome()`, `reallyStartGame()` 모두에서 `currentScore = 0` + `updateScoreUI()` |

## 랭킹 시스템 (신규, Supabase)
| 항목 | 값 |
|---|---|
| 백엔드 | Supabase (Postgres + Edge Functions + RLS), 무료 티어, 카드 등록 불필요 |
| 클라이언트 연동 파일 | `js/supabase-config.js`(URL/anon key), `js/leaderboard.js`(호출 로직) |
| 서버 코드 | `supabase/schema.sql`(테이블+RLS), `supabase/functions/start-run`, `supabase/functions/submit-score` |
| 설치 절차 | [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — 계정 생성/키 발급/함수 배포처럼 AI가 대신 못하는 작업만 정리됨 |
| 표시 위치(수정) | 홈 화면 우측 상단 `#rankingPreview`(`RankTitle.png` + TOP 5, 클릭하면 우측 랭킹 패널이 열림) |
| 미설정 시 동작 | `SUPABASE_CONFIG.url`/`anonKey`가 비어있으면 전부 조용히 비활성화되고 게임은 평소처럼 동작("랭킹 서버 준비 중"만 표시) |
| 한 사람당 기록(신규) | `leaderboard.device_id`(브라우저 localStorage에 저장된 UUID)에 unique 인덱스. 최고 기록보다 낮은 점수는 무시, 높으면 upsert로 갱신 |

### 설계 원칙 (핵심)
클라이언트(anon key)는 `leaderboard` 테이블을 **읽기만** 가능합니다(`schema.sql`에 select
정책만 있고 insert/update/delete 정책이 없음 → RLS가 기본적으로 전부 거부). **쓰기는 오직
Edge Function 두 개만** 할 수 있습니다:
- `start-run`: 게임 시작 시 호출. 서버(DB) 시계로 시작 시각을 `run_tokens`에 기록하고 토큰 발급.
- `submit-score`: 게임오버 시 호출. 토큰이 유효/미사용인지, "서버가 기록한 시작 시각부터
  지금까지의 경과 시간 안에서 이 점수가 물리적으로 가능한 값인지"(`MAX_METERS_PER_SEC = 360`,
  `submit-score/index.ts` 상단 주석에 계산 근거 있음)를 검증하고, 마지막으로 `device_id` 기준
  기존 기록보다 높을 때만 `leaderboard`에 upsert.

즉 개발자도구로 클라이언트의 `currentScore` 변수를 조작해도, 그 조작된 값을 직접 DB에
써넣을 방법이 없고, `submit-score`를 통해 보내더라도 서버가 "이 정도 시간에 이 점수는
불가능"이라고 판단하면 거부됩니다. 완벽한 방지(서버 권위 시뮬레이션)는 아니지만, 캐주얼한
조작(콘솔에서 변수 바꾸기, DB 직접 쓰기)은 확실히 막습니다.

> ⚠️ **로그인 없이 "한 사람" 구분하기**: 이 프로젝트엔 로그인 시스템이 없어서 닉네임만으로는
> 서로 다른 사람이 같은 닉네임을 쓸 때 기록이 섞입니다. 그래서 `js/leaderboard.js`의
> `getOrCreateDeviceId()`가 브라우저마다 임의의 UUID를 하나 만들어 `localStorage`
> (`dinoRunDeviceId`)에 저장해두고, 이 값을 "한 사람"의 키로 씁니다. 완벽한 신원 확인은
> 아니지만(브라우저를 지우거나 다른 기기로 하면 새 사람 취급), 별도 로그인 없이 "한 사람당
> 최고 기록 하나"를 유지하기 위한 실용적인 타협입니다.

### 연동 지점
- `reallyStartGame()`(`main.js`) → `startRunSession()` 호출.
- `gameOver()`(`gameover.js`) → `submitScoreToLeaderboard(nickname, finalScore)` 호출
  (닉네임은 기존 `nicknameInput` 전역 변수 재사용, 이 함수 안에서 `debugHitbox` 켜짐 여부도
  같이 검사해서 히트박스 켠 판은 아예 제출하지 않음. `deviceId`도 같이 실어 보냄).
- `goHome()`(`main.js`) → `refreshLeaderboardUI()` 호출(홈으로 돌아올 때 TOP 5 미리보기 갱신).
- `openRanking()`(`main.js`, `toggleRanking()`으로 열기/닫기 토글) → `refreshFullRankingUI()`
  호출(패널을 열 때만 전체 목록 + 내 순위를 불러옴 — 홈 화면 로드마다 매번 불러올 필요는 없어서).

### 랭킹 패널 UI (신규: 우측 드로어, 설정 패널과 대칭)
`#settingsPanel`(좌측)과 완전히 같은 방식으로 `#rankingPanel`을 우측에 배치했습니다.
`#homeScreen`은 이미 `[settingsPanel][homeContent(flex:1)][rankingPanel]` 3단 flex-row라서,
`ranking-open` 클래스로 `#rankingPanel`의 width를 0→30cqw로 늘리면 `homeContent`가 오른쪽에서
줄어들며 자동으로 왼쪽으로 밀린 것처럼 보입니다(설정 패널이 왼쪽에서 열릴 때 오른쪽으로 밀리는
것과 정반대 방향, 수동 좌표 계산 없이 동일한 flex 메커니즘 재사용).

패널 내부는 `#rankingListScroll`(전체 순위, `overflow-y:auto`로 스크롤)과 `#myRankRow`(내 순위,
스크롤 영역 **밖에** 있어서 스크롤해도 항상 같은 자리에 고정 — 엑셀 "틀 고정"과 같은 효과를
`position:sticky` 없이 flex 레이아웃만으로 구현)로 나뉩니다. `refreshFullRankingUI()`가
`device_id`까지 함께 select해서, 응답 배열에서 내 `deviceId`와 일치하는 행의 인덱스를 찾아
"내 순위"를 계산합니다.

> ⚠️ **수정**: `#rankingPreview`(RankTitle.png + TOP 5)가 커서 랭킹 패널이 열릴 때 패널 내용을
> 가린다는 피드백으로, `#homeScreen.ranking-open #rankingPreview { transform: scale(0.4);
> opacity: 0; }`를 추가해 패널이 열리는 것과 같은 속도(0.35s)로 작아지며 사라지도록 했습니다.
> 1위 강조는 `#leaderboardList li:first-child`, `#rankingFullList li:first-child` CSS
> 선택자로 처리합니다(목록이 항상 점수 내림차순으로 새로 그려지므로 첫 항목=1위).

### 물리 상수와 서버 검증값이 어긋나지 않게 주의
`submit-score/index.ts`의 `MAX_METERS_PER_SEC`는 `window.gameConfig.maxSpeed`와
`main.js`의 `METERS_PER_PIXEL`을 기준으로 계산된 값입니다. **이 두 값(또는 속도 관련 물리)을
나중에 바꾸면 `MAX_METERS_PER_SEC`도 다시 계산해서 Edge Function을 재배포해야 합니다** —
안 그러면 정상 플레이가 "비정상 점수"로 거부되거나, 반대로 상한선이 너무 헐거워질 수 있습니다.

## 로딩 화면 (신규)
"플레이" 버튼을 눌렀을 때 에셋 로딩이 아직 안 끝났으면(`assetsReady === false`), 곧바로
게임을 시작하지 않고 `#loadingScreen`(캔버스와 같은 어두운 배경 `#1d1d1d` 위에
`assets/setting/Loading.png`가 CSS `@keyframes spin`으로 계속 시계방향 회전)을 보여줍니다.
`pendingStart = true`로 표시해두면, `checkLoad`의 로딩 완료 분기가 `assetsReady = true`로
바꾸는 시점에 `pendingStart`를 보고 추가 클릭 없이 자동으로 `reallyStartGame()`을 호출해
게임 화면으로 전환합니다. 이미 로딩이 끝난 상태(대부분의 경우)에서 누르면 기존과 동일하게
즉시 시작됩니다.

`startGameFromHome()`은 이제 위 분기만 담당하는 얇은 함수이고, 실제 게임 시작 로직(레이어
전환, 상태 초기화, 공룡 생성, 장애물 스케줄, 루프 시작)은 `reallyStartGame()`으로 옮겨져서
"바로 시작"과 "로딩 후 자동 시작" 두 경로 모두에서 재사용됩니다.

## 드래그/선택 방지 (신규)
`style.css`의 `* { user-select: none; }`(단 `input`은 예외로 `user-select: text`)와
`img { -webkit-user-drag: none; }`, 그리고 `input.js`의
`window.addEventListener('dragstart', e => e.preventDefault())`로 이미지/텍스트를 마우스로
드래그하거나 텍스트가 선택되는 것을 전역적으로 막았습니다. 새로 추가하는 UI 요소도 이 전역
규칙 덕분에 별도 처리 없이 자동으로 드래그/선택이 안 됩니다.

## 면책 조항 (신규)
홈 화면 맨 아래(`#disclaimerText`, `#homeScreen`의 직계 자식, `position:absolute; bottom:1.5%`)에
"비상업적 팬메이드 프로젝트이며 그래픽 리소스는 모바일 게임에서 발췌, 저작권자 요청 시 삭제"
문구를 작게 표시합니다. `#homeContent`(정중앙 정렬)와 별개로 항상 화면 하단에 고정됩니다.

## 제목/닉네임칸/플레이버튼 공유 배경 이미지 (신규)
"다이노 런" 제목 글자, `#nicknameInput`, `#startBtn` 3개가
`assets/sprites/Background_Sprite_1024_Default.png` 한 장을 마치 하나의 큰 그림 위에 뚫린
3개의 창문처럼 이어서 보여줍니다. 제목은 `background-clip: text; color: transparent;
-webkit-text-fill-color: transparent;`로 글자 모양 그대로가 "창"이 되도록 처리.

| 항목 | 값 |
|---|---|
| 가로 폭 | 3개 요소(제목/닉네임칸/플레이버튼) 중 제일 왼쪽 ~ 제일 오른쪽에 정확히 맞춤 |
| 세로 기준점(수정) | `.home-controls`(닉네임+버튼 행)의 세로 중심에 이미지의 `HOME_BG_ANCHOR_RATIO_Y`(기본 2/3) 지점이 오도록 역산. 뷰포트 높이가 아니라 이미지 자기 자신의 세로 길이(=가로 폭, 정사각형) 기준 |
| 미세 조정용 상수(신규, `main.js`) | `HOME_BG_ANCHOR_RATIO_Y`(세로 기준점 비율), `HOME_BG_OFFSET_X`/`HOME_BG_OFFSET_Y`(px 미세 조정, 현재 `OFFSET_Y = -30`로 원래 위치에서 살짝 위로) — 코드 수정 없이 이 값들만 바꾸면 위치 조정 가능 |
| 계산 방식(수정) | `main.js`의 `updateHomeSharedBackground()`가 `getBoundingClientRect()`로 실제 좌표를 측정 → 폭은 `:root`의 `--home-bg-width` CSS 변수로 공유. 제목은 자기 자신이 이미지를 직접 갖고 있어서 `el.style.backgroundPosition`을 그대로 쓰고, 닉네임칸/버튼은 아래 블러 처리 때문에 이미지가 `::before`로 옮겨가서 `--bg-pos-x`/`--bg-pos-y` CSS 커스텀 프로퍼티로 값을 전달 |
| 재계산 시점 | 로드, `resize`, `fullscreenchange`, 설정/랭킹 패널 열고 닫을 때(해당 패널의 `transitionend`) |

### 이미지 살짝 블러 처리 + 닉네임칸 구조 변경 (신규)
"이미지를 살짝 흐리게" 요청으로 `filter: blur(2px)`를 적용했는데, 제목은 `background-clip:text`라
이미지가 곧 글자 모양이라서 요소 전체에 blur를 걸면 **글자 윤곽 자체가 흐려지는** 문제가
있었습니다 → 제목에는 blur를 걸지 않고 원래대로 선명하게 유지.

닉네임칸(`#nicknameInput`)/플레이버튼(`#startBtn`)은 실제 텍스트(입력값, "플레이 ▶")가
따로 있어서, 이미지만 담당하는 `::before` 레이어를 분리해 그 레이어만 `blur(2px)` 처리하고
텍스트는 그 위에 선명하게 남도록 했습니다. 단, `<input>`은 스펙상 `::before`/`::after`를
지원하지 않아서, 닉네임칸은 `<span class="nickname-bg-wrap">`으로 감싸고 그 래퍼의 `::before`가
흐린 이미지를 담당하며 입력칸 자신은 배경을 투명하게 비웠습니다.

> ⚠️ **시행착오 기록(버그, 수정됨)**: `fitNicknameFont()`(아래 참고)가 넘치는 글자를 막으려고
> `#nicknameInput`의 `font-size`를 줄일 때, `line-height`가 `normal`(font-size 비례)이라 줄
> 높이까지 같이 줄어들어서 **입력칸(과 이를 감싸는 `.nickname-bg-wrap`) 전체 높이가 타이핑할
> 때마다 미세하게 바뀌는** 문제가 있었습니다. `line-height`를 font-size와 무관한 고정값
> (`clamp(16px, 2.3cqw, 27px)`)으로 분리해서 해결했습니다.

> ⚠️ placeholder("닉네임") 글자가 브라우저 기본 회색이라 배경(투명 + 뒤의 흐린 이미지)과 구분이
> 잘 안 된다는 피드백으로, `#nicknameInput::placeholder`에 흰 글자 + 어두운 `text-shadow`를
> 지정해서 어떤 배경 색 위에서도 잘 보이도록 했습니다.

> ⚠️ **시행착오 기록(버그)**: 처음엔 세 요소 모두 `background-attachment: fixed` +
> 동일한 `background-position`(뷰포트 기준 고정 좌표)으로 구현했는데, `background-clip:text`와
> `background-attachment:fixed`를 같이 쓰면 브라우저에서 제목 글자가 아예 안 보이고 이미지도
> 이상하게 렌더링되는 문제가 있었습니다. `fixed`를 버리고, 각 요소가 **자기 자신의 박스
> 기준**으로 "가상의 하나의 큰 그림"에서 자기 위치에 해당하는 부분만 보여주도록
> `background-position`을 요소별로 다르게(음수 오프셋) 계산해서 넣는 방식으로 바꿔서
> 해결했습니다. `background-size`(폭)만 셋이 동일한 값을 공유하면 되고, 이건 CSS 변수
> (`--home-bg-width`)로 관리합니다. 정적인 CSS 값(`cover`, `center` 등)으로는 텍스트 렌더링
> 폭이 폰트/브라우저마다 달라서 "3개 중 제일 왼쪽~제일 오른쪽에 정확히 맞추기" 자체가
> 불가능해서 JS 실측이 필요합니다.

> ⚠️ **시행착오 기록**: 처음엔 "3개 뒤에 흐린 배경 이미지 하나"로 잘못 이해해서
> `#homeContent::before`에 블러 처리된 이미지를 깐 적이 있는데(사용자 승인 없이 바로
> 구현해서 지적받음 — 코드 수정 전 확인받기로 한 약속을 어긴 사례), 실제로 원한 건 "3개가
> 개별적으로 하나의 이어진 그림을 창처럼 보여주는" 효과였습니다. `background-attachment:fixed`
> 방식으로 다시 구현했습니다. 자세한 건 [[feedback_numbered_change_proposals]] 참고 —
> 이해했는지 되묻는 질문에는 확인만 하고 실제 수정은 승인 후에 해야 합니다.

## 닉네임 안전장치 (신규)
- **욕설/비속어 필터**: `supabase/functions/submit-score/index.ts`의 `sanitizeNickname()`이
  대표적인 한국어 비속어/영어 욕설 패턴(`BANNED_NICKNAME_PATTERN`)에 걸리면 닉네임을 "익명"으로
  바꿔서 저장합니다(점수 기록 자체는 그대로 유지). 클라이언트가 아니라 **서버(Edge Function)**
  에서만 검사하므로 API를 직접 호출해도 우회할 수 없습니다. 완벽한 탐지는 아니지만(초성/자모
  분리 등으로 우회 가능) 노골적인 경우는 막습니다. 단어 목록을 추가/수정하면 `submit-score`를
  다시 배포해야 합니다.
- **맞춤법 검사 비활성화**: `#nicknameInput`에 `spellcheck="false" autocorrect="off"
  autocapitalize="off"`를 추가해서 브라우저가 닉네임 아래에 빨간 밑줄을 긋거나 자동 교정/
  자동 대문자화를 하지 않도록 했습니다.
- **최대 8글자(수정, 기존 10글자)**: `#nicknameInput`의 `maxlength="8"`과
  `submit-score/index.ts`의 `MAX_NICKNAME_LEN = 8`을 함께 맞춰뒀습니다(서버 쪽은 재배포 완료).
  둘 중 하나만 바꾸면 클라이언트 제한과 서버 검증 길이가 어긋나므로 **항상 같이 수정**하세요.
- **글자 넘침 자동 축소(신규)**: 8글자 안에서도 폭이 넓은 문자(한글 등)로 입력칸 밖으로
  글자가 넘칠 수 있어서, `main.js`의 `fitNicknameFont()`가 입력할 때마다
  `scrollWidth > clientWidth`(넘침)를 확인해 넘치지 않을 때까지 `font-size`를 1px씩 줄입니다
  (최소 `NICKNAME_MIN_FONT_PX = 9`). 창 크기 조절/설정·랭킹 패널 열고 닫을 때도 다시 계산됩니다.

## 홈 화면 클릭 시 불필요한 점프 방지 (수정, `input.js`)
`mousedown`/`touchstart` 핸들러가 원래 `e.target.tagName !== 'BUTTON'`만 걸러서, 홈 화면에서
닉네임 입력칸(`<input>`, BUTTON 아님)을 클릭해도 `handleJump()`가 호출되던 문제가 있었습니다.
`INPUT` 태그도 같이 제외하도록 고쳤습니다.

## 홈 화면 - 게임 캔버스와 분리된 반응형 레이어 (신규, `.home-container`)
홈/로딩 화면과 실제 게임 캔버스가 원래 같은 `.game-container`(16:9 고정 비율) 안에 있었는데,
세로로 긴 폰 화면에서는 이 컨테이너가 폭 기준으로만 줄어들면서 세로로 아주 얇은 띠가 되고,
그 안에 홈 화면 전체(제목/닉네임/버튼/설정/랭킹/면책조항)가 욱여넣어지는 문제가 있었습니다
(버튼/글자 비율 자체는 멀쩡했지만 세로 공간이 절대적으로 부족했음).

**해결**: `#homeScreen`/`#loadingScreen`을 `.game-container` 밖으로 꺼내 새 래퍼
`.home-container`(`position: fixed; height: 100%; max-width: 1200px; margin: 0 auto;
container-type: inline-size;`)로 감쌌습니다. `.game-container`는 이제 `#gameScreen`(실제
달리기 게임)만 담당하고 16:9 비율을 그대로 유지합니다. `.home-container`는 비율 제약 없이
뷰포트 전체 높이를 그대로 쓰므로, 폰 세로 화면에서도 홈 화면이 답답하지 않게 넓게 보입니다.
가로 폭 기준 `cqw` 계산은 기존과 동일(둘 다 `max-width: 1200px`)이라 폰트/버튼 크기 값들은
그대로 유지됩니다 — 이번 변경은 **세로 공간만** 늘린 것입니다.

> ⚠️ **주의**: `.home-container`와 `.game-container` 둘 다 항상 레이아웃에 존재하다 보니(내용이
> `.hidden`이어도 컨테이너 박스 자체는 남아있음), 한쪽이 비어있을 때 클릭이 그 빈 박스에
> 막혀 반대쪽 화면 버튼을 못 누르는 문제가 생길 수 있었습니다. 둘 다 `pointer-events: none`을
> 주고, 실제 내용이 있는 `.ui-layer`(hidden이 아닐 때)에만 `pointer-events: auto`를 줘서
> 해결했습니다. **앞으로 이 두 컨테이너 중 하나에 새 직계 자식을 추가한다면 `.ui-layer`
> 클래스를 꼭 붙이세요** — 안 그러면 클릭이 씹히는 문제가 재발합니다.

## 모바일 전체화면(가로) 전환 버튼 (신규)
홈 화면 우측 하단에 `#fullscreenBtn`(`.corner-btn.fullscreen-btn`, "⛶" 글리프)을 추가했습니다.
`toggleFullscreen()`(`main.js`)이 `document.documentElement.requestFullscreen()`으로 전체화면을
켜고, 성공하면 `screen.orientation.lock('landscape')`로 가로 방향 고정을 시도합니다. 이미
전체화면이면 `document.exitFullscreen()`으로 되돌립니다.

| 항목 | 값 |
|---|---|
| 노출 조건 | `@media (pointer: coarse)`(터치 기기 = 대부분 모바일/태블릿)일 때만 `display:flex`, 그 외(데스크톱)엔 숨김 |
| 위치 | `.corner-btn`(설정 버튼)과 같은 원형 스타일 재사용, `top`/`left` 대신 `bottom:3%; right:2%`로 우측 하단에 배치 |
| 가로 고정 미지원 브라우저 | `screen.orientation.lock()`은 iOS Safari가 지원하지 않음 — 이 경우 전체화면은 켜지지만 가로 고정은 조용히 실패하고(`.catch(()=>{})`), 사용자가 기기를 직접 돌려야 함 |

## game-container 뷰포트 대응 (신규)
`.game-container`의 크기를 CSS 단위(vw/vh/aspect-ratio) 계산에 맡기지 않고, `main.js`의
`resizeGameContainer()`가 `window.innerWidth`/`innerHeight`를 기준으로 px 단위로 직접 계산해서
인라인 스타일로 못박습니다. `load` 시 1회 실행하고 `resize`, `fullscreenchange` 이벤트에도
다시 계산합니다. CSS는 JS 실행 전 잠깐 쓰이는 폴백(`width:100%; max-width:1200px;
aspect-ratio:16/9;`)만 남겨뒀습니다.

> ⚠️ **시행착오 기록**: 처음엔 `width: min(100%, 1200px, 177.78vh)` 같은 CSS 단위 계산으로
> "창 높이가 16:9보다 갸름한 경우 컨테이너가 뷰포트를 벗어나는" 문제를 고쳤는데, 이후
> 사용자가 4K 모니터에서 브라우저를 전체화면으로 켰을 때 버튼들이 우측 하단으로 밀리고
> 일시정지 버튼의 정사각형 비율이 깨지는 문제를 보고했습니다. 정확한 브라우저별 원인은
> 특정하기 어려웠지만(고해상도/OS 디스플레이 배율과 vw·vh·aspect-ratio 조합이 브라우저마다
> 다르게 계산될 여지가 있음), CSS 단위 계산에 의존하는 한 이런 종류의 문제가 계속 재발할
> 가능성이 있다고 판단해서, 아예 JS가 `innerWidth`/`innerHeight` 픽셀값을 직접 읽어 계산하는
> 방식으로 바꿔 근본적으로 회피했습니다.

### 진짜 원인: 자식 요소 글자 크기(vw)가 컨테이너가 아닌 뷰포트를 따라가던 문제
컨테이너 크기(위 항목)는 고쳤는데도, 전체화면 4K에서 점수 글자가 커지고 일시정지 버튼
비율이 깨지는 문제가 계속 보고됐습니다. 실제 원인은 `#pauseBtn`, `.corner-btn`,
`#bestScoreText`, `#currentScoreText`, `#finalScoreText`, `#resumeBtn`, `.sub-buttons button`,
`#gameOverText`의 **`font-size`가 `vw`(뷰포트 너비 기준) 단위**였던 것입니다. 버튼의 `width`는
`%`(컨테이너 기준)라서 1200px 캡을 잘 따르는데, `font-size`는 `vw`라서 컨테이너 크기와
무관하게 실제 화면 너비(4K 전체화면 = 3840px)를 그대로 따라가 버려 글자가 버튼보다
커지면서 정사각형이 깨지고 점수 글자도 과도하게 커졌습니다.

**해결**: `.game-container`에 `container-type: inline-size;`를 선언해서 컨테이너 쿼리
컨테이너로 만들고, 위 요소들의 `font-size`를 전부 `vw` → `cqw`(컨테이너 쿼리 너비 단위,
`.game-container`의 실제 너비 기준)로 교체했습니다. 이제 글자 크기가 항상 컨테이너 크기에
정확히 비례하므로, 창 크기/전체화면/4K 여부와 무관하게 버튼과 점수 텍스트 모두 같은 비율을
유지합니다. **앞으로 새 UI 요소를 `.game-container` 안에 추가할 때 화면 비례 글자 크기가
필요하면 `vw`가 아니라 `cqw`를 쓰세요** — 안 그러면 이 문제가 재발합니다.

## 알려진 개선 여지 (다음에 손볼 것)
- 전역 변수가 여러 js 파일에 흩어져 있음 (`isGameOver`, `isPaused` 등) → 나중에 `Game` 객체로 통합 고려
- 이미지 에셋 경로가 틀리면 콘솔에 경고가 뜨도록 onerror 추가함 (이제 무한 로딩 안 걸림)
- 랭킹 시스템 미구현 (홈 화면 우측 상단에 추가 예정이라고 사용자가 언급함)
- **배경/장애물이 가끔 울렁거리는 현상(보류 중)**: 프레임 호출 간격이 불균일할 때 "매 프레임
  고정량 이동" 방식이라 생기는 문제로, 근본적으로 고치려면 델타타임을 다시 도입해야 하는데
  이건 [[project_speed_architecture]]에 기록된 대로 한 번 롤백을 요청받은 민감한 영역입니다.
  사용자가 고민 중이라고 해서 **다음에 명시적으로 요청받을 때까지 건드리지 않습니다.**