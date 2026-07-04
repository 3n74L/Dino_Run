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

## obstacle.js - 장애물
| 항목 | 값 |
|---|---|
| 지상 장애물 스케일 | 0.45 |
| 공중 장애물 스케일 | 0.26~0.30 (랜덤) |
| 지상 히트박스 | 원본의 90% |
| 공중 히트박스 | 원본의 90% (0번 프레임은 1번 프레임 크기로 고정 후 90%) |
| 3연속 배치 조건 | speed >= 6, 40% 확률 |
| 2연속 배치 조건 | speed >= 4, 50% 확률 |
| 공중 등장 확률 | 단독 장애물일 때 30% |

## background.js - 낮/밤 시스템
| 항목 | 값 |
|---|---|
| 낮 하늘색 | rgb(135, 206, 235) |
| 밤 하늘색 | rgb(0, 0, 0) |
| 태양/달 이동 targetX | 1100 |
| 전환 속도(transitionSpeed) | 12 |
| 진입 후 감속 시간(settleDurationMs, 신규) | 300ms (ease-out 3차) |
| 천체 이동 속도(celestialSpeedRate) | baseSpeed * 0.096 |
| 최대 암전 정도(darkness) | 0.40 |
| 어둠 필터 공식 (★공용 함수화됨) | `background.getFilterString()` |

> ⚠️ **중요**: 어둠 필터(`brightness(...)`)는 이제 `background.getFilterString()` 한 곳에서만
> 계산합니다. `main.js`의 게임 루프와 `gameover.js`의 게임오버 연출 모두 이 함수를 호출해서
> 필터를 적용해야 합니다. 필터 관련 로직을 다시 손볼 때는 **절대 이 함수를 두 번 따로 만들지 마세요**
> (이번에 고친 "게임오버 시 필터 풀리는 버그"의 원인이 바로 이 중복이었습니다).

## 상태 관리 흐름 (Background.state)
```
day -> sun_phase_out -> moon_phase_in -> moon_settling(0.3초 감속) -> night
     -> moon_phase_out -> sun_phase_in -> sun_settling(0.3초 감속) -> day (반복)
```
> 퇴장(phase_out)은 여전히 transitionSpeed로 즉시 빠르게 나감. 진입(phase_in)만
> targetX 도달 후 곧바로 등속 궤도 속도로 바뀌지 않고, settling 상태에서 0.3초간
> ease-out으로 부드럽게 감속됨.

## 알려진 개선 여지 (다음에 손볼 것)
- 전역 변수가 여러 js 파일에 흩어져 있음 (`isGameOver`, `isPaused` 등) → 나중에 `Game` 객체로 통합 고려
- 이미지 에셋 경로가 틀리면 콘솔에 경고가 뜨도록 onerror 추가함 (이제 무한 로딩 안 걸림)