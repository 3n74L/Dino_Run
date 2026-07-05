// 1. 캔버스 및 게임 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1200;
canvas.height = 675;
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// [수정] 4K 등 초고해상도 모니터에서 브라우저를 전체화면으로 켰을 때, CSS의 %/vw/vh +
// aspect-ratio 조합만으로는 브라우저/OS 배율(디스플레이 확대)에 따라 컨테이너 크기가
// 어긋나면서 버튼이 우측 하단으로 밀리거나 정사각형 버튼의 비율이 깨지는 문제가 보고됨.
// -> 컨테이너 크기를 vw/vh 단위 계산에 맡기지 않고 JS에서 직접 px로 못박아서,
// 브라우저의 단위 해석/DPI 스케일링 차이에 전혀 영향받지 않도록 함.
function resizeGameContainer() {
    const container = document.querySelector('.game-container');
    if (!container) return;
    const NATIVE_W = 1200, NATIVE_H = 675; // 캔버스 네이티브 해상도(16:9)와 동일
    const scale = Math.min(window.innerWidth / NATIVE_W, window.innerHeight / NATIVE_H, 1);
    container.style.width = `${NATIVE_W * scale}px`;
    container.style.height = `${NATIVE_H * scale}px`;
}

// [수정] 제목/닉네임칸/플레이버튼이 공유하는 배경 이미지의 위치/크기를 실제 렌더링된 좌표로
// 맞춘다. "3개 중 제일 왼쪽 ~ 제일 오른쪽에 정확히 맞추기"는 텍스트 렌더링 폭이 폰트/브라우저
// 마다 달라서 정적인 CSS 값으로는 정확히 계산할 수 없다 -> getBoundingClientRect()로 실제
// 좌표를 잰다.
// 처음엔 background-attachment:fixed(뷰포트 기준 고정)로 구현했는데, background-clip:text와
// 같이 쓰면 브라우저에 따라 렌더링이 깨지는 문제가 있었다. 그래서 각 요소마다 "가상의 하나의
// 큰 그림"에서 자기 위치에 해당하는 부분만 보이도록 background-position을 요소별로 다르게
// (음수 오프셋으로) 계산해서 인라인 스타일로 직접 넣는 방식으로 바꿨다.
// [버그 수정] "이미지의 y좌표는 위에서부터 2/3 지점"을 뷰포트 높이 기준(window.innerHeight*2/3)
// 으로 잘못 이해해서, 화면이 세로로 길 때 이미지 전체가 UI 그룹 밖으로 밀려나 3개 요소가 전부
// (제목 포함) 이미지의 범위를 벗어나 아무것도 안 보이는 문제가 있었다. 실제 의도는 "닉네임+
// 플레이버튼의 화면상 위치가, 이미지 자기 자신의 세로 길이 기준 2/3 지점과 겹치도록"이었다.
// -> .home-controls(닉네임+버튼을 감싸는 행)의 세로 중심 좌표를 기준점으로 삼아, 그 지점에
// 이미지의 HOME_BG_ANCHOR_RATIO_Y 지점이 오도록 이미지의 가상 top 좌표(sharedTop)를 역산한다.

// 아래 값들만 바꾸면 코드 수정 없이 이미지 위치를 조정할 수 있음.
const HOME_BG_ANCHOR_RATIO_Y = 2 / 3; // .home-controls 중심에 맞출 이미지 세로 기준점 (0=맨위, 1=맨아래)
const HOME_BG_OFFSET_X = 0; // 추가 미세 조정 (px, +면 이미지가 오른쪽으로 이동)
const HOME_BG_OFFSET_Y = -30; // 추가 미세 조정 (px, +면 이미지가 아래로 이동) - 원래 위치에서 살짝 위로

// [수정] 닉네임칸은 흐림 처리를 위해 배경 이미지를 .nickname-bg-wrap(입력칸을 감싸는 래퍼)의
// ::before로 옮겼다(input은 ::before/::after를 지원하지 않아서 원래 요소에는 못 둠). 그래서
// 위치/폭 계산에 쓰는 기준 박스는 여전히 입력칸의 실제 렌더링 영역(=래퍼가 감싸는 영역)을
// 쓰지만, 값을 적용하는 대상(el.style)은 래퍼가 된다. 가상 요소엔 인라인 style을 직접 줄 수
// 없어서, 제목(자기 자신이 이미지를 직접 가짐)은 기존처럼 backgroundPosition을 그대로 쓰고,
// 래퍼/버튼(이미지가 ::before에 있음)은 CSS 커스텀 프로퍼티(--bg-pos-x/--bg-pos-y)로 값을
// 전달해서 ::before가 var()로 읽어가게 한다.
function updateHomeSharedBackground() {
    const title = document.querySelector('.game-title');
    const nicknameWrap = document.querySelector('.nickname-bg-wrap');
    const button = document.getElementById('startBtn');
    const controls = document.querySelector('.home-controls');
    if (!title || !nicknameWrap || !button || !controls) return;

    const els = [title, nicknameWrap, button];
    const rects = els.map(el => el.getBoundingClientRect());
    const sharedWidth = Math.max(1, Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left)));
    const sharedLeft = Math.min(...rects.map(r => r.left)) + HOME_BG_OFFSET_X;

    // 이미지가 1024x1024 정사각형이라, 폭을 sharedWidth로 맞추면(auto 높이) 높이도 sharedWidth와 같다.
    const imageHeight = sharedWidth;

    const controlsRect = controls.getBoundingClientRect();
    const controlsCenterY = controlsRect.top + controlsRect.height / 2;
    const sharedTop = controlsCenterY - imageHeight * HOME_BG_ANCHOR_RATIO_Y + HOME_BG_OFFSET_Y;

    document.documentElement.style.setProperty('--home-bg-width', `${sharedWidth}px`);

    const [titleRect, wrapRect, buttonRect] = rects;
    title.style.backgroundPosition = `${sharedLeft - titleRect.left}px ${sharedTop - titleRect.top}px`;

    [[nicknameWrap, wrapRect], [button, buttonRect]].forEach(([el, r]) => {
        el.style.setProperty('--bg-pos-x', `${sharedLeft - r.left}px`);
        el.style.setProperty('--bg-pos-y', `${sharedTop - r.top}px`);
    });
}

// 닉네임 입력 값 저장/복원 (추후 랭킹 시스템에서 사용할 수 있도록 로컬에 보관)
const NICKNAME_STORAGE_KEY = 'dinoRunNickname';
const nicknameInput = document.getElementById('nicknameInput');

// [신규] 닉네임 최대 8글자(maxlength) 안에서도, 넓은 한글/이모지 등으로 글자가 입력칸
// 밖으로 넘칠 수 있다. 넘치면(scrollWidth > clientWidth) CSS가 정한 원래 크기(clamp로
// 화면 크기에 비례해 정해짐)에서부터 한 글자도 안 잘리고 다 보일 때까지 글자 크기를
// 조금씩 줄인다. 화면 크기가 바뀌면(원래 크기 자체가 바뀌므로) 매번 원래 크기로
// 리셋한 뒤 다시 검사한다.
const NICKNAME_MIN_FONT_PX = 9;
function fitNicknameFont() {
    if (!nicknameInput) return;
    nicknameInput.style.fontSize = ''; // CSS clamp가 정한 "원래" 크기로 리셋 후 다시 판정
    let size = parseFloat(getComputedStyle(nicknameInput).fontSize);
    while (nicknameInput.scrollWidth > nicknameInput.clientWidth && size > NICKNAME_MIN_FONT_PX) {
        size -= 1;
        nicknameInput.style.fontSize = `${size}px`;
    }
}

if (nicknameInput) {
    nicknameInput.value = localStorage.getItem(NICKNAME_STORAGE_KEY) || '';
    nicknameInput.addEventListener('input', () => {
        localStorage.setItem(NICKNAME_STORAGE_KEY, nicknameInput.value);
        fitNicknameFont();
    });
}

resizeGameContainer();
updateHomeSharedBackground();
fitNicknameFont();
window.addEventListener('resize', () => {
    resizeGameContainer();
    updateHomeSharedBackground();
    fitNicknameFont();
});
document.addEventListener('fullscreenchange', () => {
    resizeGameContainer();
    updateHomeSharedBackground();
    fitNicknameFont();
});

// 설정/랭킹 패널이 열리고 닫힐 때도 #homeContent의 실제 폭이 바뀌면서 제목/닉네임칸/
// 플레이버튼 위치가 이동하므로, 그 트랜지션(width 0.35s)이 끝난 뒤 다시 계산해준다.
const settingsPanelEl = document.getElementById('settingsPanel');
const rankingPanelEl = document.getElementById('rankingPanel');
function onHomePanelTransitionEnd() {
    updateHomeSharedBackground();
    fitNicknameFont();
}
if (settingsPanelEl) settingsPanelEl.addEventListener('transitionend', onHomePanelTransitionEnd);
if (rankingPanelEl) rankingPanelEl.addEventListener('transitionend', onHomePanelTransitionEnd);

window.gameConfig = {
    baseSpeed: 2,
    maxSpeed: 12,
    groundY: 560,
    debugHitbox: false // [수정] 디버그용 빨간 히트박스가 항상 그려지던 문제 -> 기본값 off로 변경
};

// 게임 제어 플래그
let isPaused = false;
let isLoopRunning = false;
let isAudioOn = true;
let isInputActive = false;
let obstacleTimeout = null;
let jumpBufferTime = 0;
const JUMP_BUFFER_MS = 150; // 선입력 유효 기간 (0.15초)

// [신규] 기기 주사율(모니터 Hz)에 관계없이 게임 속도가 항상 동일하게 느껴지도록 하는
// 델타타임 정규화. 기존 코드는 "매 프레임(=requestAnimationFrame 호출마다) 고정량 이동"
// 방식이라, 호출 빈도(주사율)가 곧 실제 속도가 되어버렸다. 240Hz 모니터는 초당 240번
// 호출되지만 대부분의 폰은 초당 60~120번만 호출되므로, 같은 코드가 기기마다 완전히
// 다른 체감 속도로 동작했다(폰에서 공룡 점프/배경 이동이 몇 배나 느려짐). 게다가 장애물
// 생성 간격은 setTimeout(실제 ms 기준)이라 주사율과 무관한데 이동 속도만 주사율에
// 종속되니, 저주사율 기기에서는 장애물이 미처 화면 밖으로 안 빠진 채 다음 장애물이
// 겹쳐서 나오는 문제까지 있었다.
//
// FRAME_REFERENCE_MS를 "240fps일 때의 한 프레임 시간"으로 잡은 이유: 지금까지 튜닝된
// 모든 물리 상수(dino.js의 gravity/jumpStrength, baseSpeed 등)는 개발 환경(240Hz 모니터)
// 에서 체감으로 맞춘 값이다. 240을 기준으로 삼으면 240Hz에서는 deltaFactor가 항상 1에
// 가까워서 기존 동작과 100% 동일하게 유지되고, 그보다 느린 기기에서만 deltaFactor가
// 1보다 커지는 방식으로 "부족한 이동량"을 보정해 실제 시간(초) 기준 속도를 통일한다.
const FRAME_REFERENCE_MS = 1000 / 240;
// tab 전환/백그라운드 복귀처럼 프레임이 한참 멈췄다가 재개될 때, 그 멈춘 시간까지
// deltaFactor에 그대로 반영하면 물리가 한 프레임에 몰아서 폭주할 수 있어 상한을 둔다.
const MAX_DELTA_FACTOR = 20;
let lastFrameTime = null;

function computeDeltaFactor(timestamp) {
    if (lastFrameTime === null) {
        lastFrameTime = timestamp;
        return 1;
    }
    const rawDelta = (timestamp - lastFrameTime) / FRAME_REFERENCE_MS;
    lastFrameTime = timestamp;
    return Math.min(Math.max(rawDelta, 0), MAX_DELTA_FACTOR);
}

// 일시정지/재시작 등으로 루프가 끊겼다가 다시 시작될 때 호출한다. 끊겨있던 실제 시간을
// 다음 프레임의 deltaFactor에 몰아넣지 않도록, 다음 프레임을 "기준 프레임"(deltaFactor=1)
// 으로 리셋한다.
function resetFrameTiming() {
    lastFrameTime = null;
}

// [신규] 에셋 로딩 상태. 플레이 버튼을 눌렀는데 아직 로딩이 안 끝났으면 로딩 화면을 보여주고,
// 로딩이 끝나는 즉시(추가 클릭 없이) 자동으로 게임을 시작한다.
let assetsReady = false;
let pendingStart = false;

// 점수(거리) 시스템: 이동 거리를 M(미터) 단위로 환산해서 표시.
// 10px 이동 = 1M (체감상 자연스러운 속도로 튜닝한 값)
const BEST_SCORE_STORAGE_KEY = 'dinoRunBestScore';
const METERS_PER_PIXEL = 0.1;
let currentScore = 0;
let bestScore = Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY)) || 0;

// [신규] 점수 2만(미터) 돌파 시 배경음악을 아레나 트랙으로 한 번만 전환하기 위한 플래그.
// 새 판이 시작될 때(restartGame/reallyStartGame)마다 false로 리셋된다.
const ARENA_BGM_SCORE_THRESHOLD = 20000;
let arenaBgmTriggered = false;

// [신규] 공중 장애물(프테라노돈)의 속도 편차(obstacle.js의 speedOffset) 중 "느림" 쪽은
// 이 점수(미터)를 넘기 전까지는 나오지 않는다. baseSpeed가 아직 낮은 초반에는 ±0.1~0.3
// 편차의 상대적 비중이 커서, 느린 프테라 바로 뒤에 빠른 프테라가 붙어 나오면 점프할 시간이
// 없을 정도로 간격이 좁아지는 문제가 있었다. baseSpeed가 충분히 오른 뒤(같은 편차라도
// 상대적으로 미미해짐)에만 느림/빠름을 둘 다 허용한다.
const PTERA_SLOW_UNLOCK_SCORE = 250;

function updateScoreUI() {
    const currentEl = document.getElementById('currentScoreText');
    const bestEl = document.getElementById('bestScoreText');
    if (currentEl) currentEl.innerText = `${Math.floor(currentScore)}M`;
    if (bestEl) bestEl.innerText = `BEST ${Math.floor(bestScore)}M`;
}
updateScoreUI(); // 최고 기록 초기 표시

// [신규] 홈 화면 배경음악 재생 시도. 사용자가 아직 페이지와 상호작용하기 전이라 대부분의
// 브라우저가 자동재생을 막지만(조용히 무시됨), js/audio.js의 첫 클릭/키/터치 리스너가
// 실제로 재생을 다시 시도해준다.
if (typeof playHomeBgm === 'function') playHomeBgm();

// 공통 점프 실행 함수
// [버그 수정] 홈 화면에서도 (버튼/입력칸이 아닌) 화면 아무 곳이나 클릭하면 이 함수가
// 호출됐다. 에셋 로딩이 끝나면 dino 객체가 이미 만들어져 있어서(홈 화면에 있는 동안에도),
// 게임 화면이 안 보이는 상태에서도 dino.jump()가 조용히 호출되고 있었다 - 시각적으로는
// 아무 영향 없었지만(그 dino 인스턴스는 실제 플레이 시작 시 새로 교체되어 버려짐), 이번에
// 점프 효과음을 추가하면서 "게임 시작할 때(=홈 화면에서 플레이 버튼 누르기 전후로 클릭할
// 때) 점프 소리가 들리는" 문제로 드러났다. 게임 화면이 실제로 보일 때만 점프 입력을
// 받도록 가드를 추가해서 해결.
function handleJump() {
    if (isGameOver || isPaused) return;

    const gameScreen = document.getElementById('gameScreen');
    if (!gameScreen || gameScreen.classList.contains('hidden')) return;

    if (dino) {
        if (dino.y >= window.gameConfig.groundY) {
            if (isInputActive) return;
            dino.jump();
            isInputActive = true;
            jumpBufferTime = 0; // 선입력 초기화
        } else {
            // 현재 입력된 시간을 기록
            jumpBufferTime = Date.now();
        }
    }
}

function handleInputRelease() {
    isInputActive = false;
}

// 일시정지 기능 제어 함수
function togglePause() {
    if (isGameOver) return;

    isPaused = !isPaused;
    const overlay = document.getElementById('pauseOverlay');

    if (isPaused) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        if (!isLoopRunning) {
            resetFrameTiming(); // 일시정지 중 멈춰있던 시간이 델타타임에 몰아서 반영되지 않도록
            requestAnimationFrame(gameLoop);
        }
    }
}

function restartGame() {
    // 1. 기존에 쌓여있던 장애물 생성 타이머부터 확실하게 제거
    if (obstacleTimeout) {
        clearTimeout(obstacleTimeout);
        obstacleTimeout = null;
    }

    // 2. 게임오버 및 일시정지 UI 숨기기
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    gameOverOverlay.classList.remove('show');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');

    // 3. 게임 전반 플래그 및 연출 상태 리셋 (gameover.js 함수 호출)
    resetGameOverState();
    isPaused = false;
    isInputActive = false;
    if (background && typeof background.reset === 'function') {
        background.reset();
    }
    jumpBufferTime = 0;

    // 4. 인게임 핵심 데이터 초기화
    window.gameConfig.baseSpeed = 2; // 초기 속도로 리셋
    obstacles = []; // 기존 장애물 전부 제거
    currentScore = 0;
    updateScoreUI();
    arenaBgmTriggered = false; // [신규] 새 판이니 아레나 배경음악 전환 여부도 리셋
    if (typeof playGameBgm === 'function') playGameBgm(); // [신규] 인게임 배경음악 재생

    // 5. 공룡 인스턴스를 새롭게 생성하여 잔존 물리 데이터 완벽 초기화
    if (dinoParts) {
        dino = new Dino(ctx, dinoParts);
    }

    // 6. 장애물 생성 새 스케줄 시작
    spawnObstacle();

    // 7. 루프가 완전히 끊겼을 때만 안전하게 실행
    resetFrameTiming(); // 새 판을 델타타임 기준 프레임(deltaFactor=1)부터 시작
    if (!isLoopRunning) {
        requestAnimationFrame(gameLoop);
    }
}

function goHome() {
    if (obstacleTimeout) {
        clearTimeout(obstacleTimeout);
        obstacleTimeout = null;
    }

    // 1. 인게임 UI 오버레이 은닉 및 상태 리셋
    if (typeof resetGameOverState === 'function') resetGameOverState();
    isPaused = false;
    isInputActive = false;
    isLoopRunning = false; // 홈으로 갈 때 루프 작동 플래그 OFF
    obstacles = [];
    window.gameConfig.baseSpeed = 2;
    currentScore = 0;
    updateScoreUI();

    document.getElementById('gameOverOverlay').classList.remove('show');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');

    // 2. 레이어 전환 (게임 스크린 숨기고 홈 스크린 표시)
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('homeScreen').classList.remove('hidden');

    // [신규] 방금 새 기록이 등록됐을 수 있으니 홈으로 돌아올 때 랭킹 목록을 다시 불러온다.
    if (typeof refreshLeaderboardUI === 'function') refreshLeaderboardUI();

    // [신규] 인게임 배경음악(또는 아레나 배경음악)에서 홈 화면 배경음악으로 전환
    if (typeof playHomeBgm === 'function') playHomeBgm();
}

// [수정] 소리 버튼을 이모지 텍스트 대신 Sound_Off.png(항상 표시) + Sound_On.png(소리 켜졌을
// 때만 표시) 아이콘 조합으로 변경. Off 이미지 오른쪽에 On 이미지를 나란히 둬서 "소리가
// 들리는 중"을 표현하고, 끄면 On 이미지만 숨긴다. 일시정지 메뉴(#soundBtn)와 홈 설정
// (#settingsSoundBtn) 둘 다 같은 클래스(.sound-on-icon)를 쓰므로 한 번에 동기화된다.
function toggleSound() {
    isAudioOn = !isAudioOn;
    document.querySelectorAll('.sound-on-icon').forEach(img => {
        img.style.display = isAudioOn ? '' : 'none';
    });
    // [신규] 설정 패널의 소리 버튼도 켜짐 상태(기본값 on)를 노란색으로 표시.
    // .setting-row button.on 규칙만 노란 배경을 적용하므로, .setting-row 밖에 있는
    // 일시정지 메뉴의 원형 소리 버튼(#soundBtn)에는 이 클래스가 붙어도 시각적 영향이 없다.
    document.querySelectorAll('.sound-btn').forEach(btn => {
        btn.classList.toggle('on', isAudioOn);
    });
    // [신규] 지금 재생 "되어야 하는" 배경음악도 같이 멈추거나 재개한다.
    if (typeof applyAudioOnState === 'function') applyAudioOnState();
}

// 히트박스 표시 토글 (설정 화면 전용). 개발용 디버그 시각화를 플레이어가 직접 켤 수 있게 하되,
// 랭킹 시스템 도입 시 이 값이 켜져 있으면 등록 제외 처리할 수 있도록 gameConfig.debugHitbox로 노출.
function toggleHitbox() {
    window.gameConfig.debugHitbox = !window.gameConfig.debugHitbox;
    const btn = document.getElementById('settingsHitboxBtn');
    if (btn) {
        btn.innerText = window.gameConfig.debugHitbox ? "ON" : "OFF";
        // [신규] 켜져 있음을 노란색으로 표시
        btn.classList.toggle('on', window.gameConfig.debugHitbox);
    }
}

// 반전 모드 토글: 켜면 게임 캔버스 전체에 CSS 색상 반전 필터를 적용한다.
// (background.js의 밤/낮 밝기 필터는 캔버스 내부 그리기에만 적용되는 것과 별개로,
// 이건 최종 렌더링된 화면 전체에 CSS filter로 적용되는 것이라 서로 간섭하지 않는다.)
let isInvertOn = false;
function toggleInvert() {
    isInvertOn = !isInvertOn;
    document.getElementById('gameCanvas').classList.toggle('invert-mode', isInvertOn);
    const btn = document.getElementById('settingsInvertBtn');
    if (btn) {
        btn.innerText = isInvertOn ? "ON" : "OFF";
        btn.classList.toggle('on', isInvertOn); // [신규] 켜져 있음을 노란색으로 표시
    }
}

// 설정 패널 열기/닫기 (홈 화면 전용)
// [수정] 반투명 오버레이로 위를 덮던 방식 -> #homeScreen에 'settings-open' 클래스를 토글해서
// CSS(width 0 -> 30cqw)로 좌측 드로어가 슬라이드되어 나오고, homeContent가 그만큼 오른쪽으로
// 밀려나도록 변경 (뒤 내용이 비쳐서 안 보이던 문제 해결). 톱니바퀴 버튼의 회전 애니메이션도
// 같은 'settings-open' 클래스를 기준으로 CSS에서 처리한다.
function openSettings() {
    // 소리 아이콘은 toggleSound()가 항상 두 버튼(#soundBtn, #settingsSoundBtn)을 동시에
    // 갱신하므로 여기서 따로 동기화할 필요가 없다.
    const hitboxBtn = document.getElementById('settingsHitboxBtn');
    if (hitboxBtn) {
        hitboxBtn.innerText = window.gameConfig.debugHitbox ? "ON" : "OFF";
        hitboxBtn.classList.toggle('on', window.gameConfig.debugHitbox);
    }
    const invertBtn = document.getElementById('settingsInvertBtn');
    if (invertBtn) {
        invertBtn.innerText = isInvertOn ? "ON" : "OFF";
        invertBtn.classList.toggle('on', isInvertOn);
    }
    document.getElementById('homeScreen').classList.add('settings-open');
}

function closeSettings() {
    document.getElementById('homeScreen').classList.remove('settings-open');
}

// [수정] 톱니바퀴 버튼을 다시 눌러도 닫히도록 토글 함수로 변경 (기존엔 열기만 됐음)
function toggleSettings() {
    const homeScreen = document.getElementById('homeScreen');
    if (homeScreen.classList.contains('settings-open')) {
        closeSettings();
    } else {
        openSettings();
    }
}

// [신규] 모바일 전체화면(가로) 전환. 전체화면 전환 자체(requestFullscreen)는 대부분의
// 모바일 브라우저가 지원하지만, 화면 방향을 가로로 고정하는 screen.orientation.lock()은
// 전체화면 상태에서만 허용되고 iOS Safari는 아예 지원하지 않는다. 그래서 lock을 못 해도
// (iOS 등) 조용히 무시하고 전체화면 자체는 그대로 유지한다 - 이 경우 사용자가 기기를
// 직접 가로로 돌리면 된다.
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        const request = document.documentElement.requestFullscreen();
        if (request && typeof request.then === 'function') {
            request.then(() => {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            }).catch(() => {});
        }
    } else {
        document.exitFullscreen();
    }
}

// 랭킹 패널 열기/닫기 (홈 화면 전용, 설정 패널과 완전히 대칭 구조).
// 'ranking-open' 클래스만 토글하면 CSS(width 0 -> 30cqw, 우측 드로어)가 나머지를 처리하고,
// homeContent가 flex:1이라 이 패널이 넓어지는 만큼 자동으로, 정확히 그만큼 왼쪽으로 밀려난다.
function openRanking() {
    document.getElementById('homeScreen').classList.add('ranking-open');
    // 홈 화면 상단 미리보기(TOP 5)와 달리, 패널 안 전체 목록+내 순위는 열 때만 불러온다.
    if (typeof refreshFullRankingUI === 'function') refreshFullRankingUI();
}

function closeRanking() {
    document.getElementById('homeScreen').classList.remove('ranking-open');
}

function toggleRanking() {
    // [신규] #rankingPreview는 <button>이 아니라 <div>라서 audio.js의 전역 버튼 클릭음
    // 리스너가 안 잡는다. 여기서 직접 재생해서 다른 버튼들과 동일하게 클릭음이 나도록 함.
    if (typeof playButtonClickSfx === 'function') playButtonClickSfx();

    const homeScreen = document.getElementById('homeScreen');
    if (homeScreen.classList.contains('ranking-open')) {
        closeRanking();
    } else {
        openRanking();
    }
}

// 3. 캐싱 시스템
const spriteCache = {};
function preloadObstacles() {
    const types = ['realmetal', 'stone', 'wood'];
    const levels = [1, 2, 3];
    types.forEach(t => {
        levels.forEach(l => {
            const key = `${t}${l}`;
            const img = new Image();
            img.src = `assets/obstacle/${key}_NodeImg.png`;
            // [수정] 로드 실패해도 checkLoad가 영원히 멈추지 않도록 콘솔 경고만 남김
            // (spritesLoaded 체크는 img.complete만 보므로, 실패해도 complete는 true가 됨)
            img.onerror = () => console.warn(`[Obstacle] 이미지 로드 실패: ${img.src}`);
            spriteCache[key] = img;
        });
    });

    const airImgs = [new Image(), new Image()];
    airImgs[0].src = 'assets/obstacle/Archaeopteryx_0.png';
    airImgs[1].src = 'assets/obstacle/Archaeopteryx_1.png';
    airImgs.forEach(img => {
        img.onerror = () => console.warn(`[Obstacle] 이미지 로드 실패: ${img.src}`);
    });
    spriteCache['air_obstacle'] = airImgs;
}
preloadObstacles();

const background = new Background(canvas);
const dinoParts = {
    Body: new Image(), Belly: new Image(),
    R_Arm: new Image(), L_Arm: new Image(),
    R_Leg: new Image(), L_Leg: new Image()
};
Object.keys(dinoParts).forEach(name => {
    dinoParts[name].src = `assets/dino/${name}.png`;
    dinoParts[name].onerror = () => console.warn(`[Dino] 이미지 로드 실패: ${dinoParts[name].src}`);
});

let dino = null;
let obstacles = [];

// 4. 장애물 생성 함수
function spawnObstacle() {
    if (isGameOver) return;
    if (isPaused) {
        obstacleTimeout = setTimeout(spawnObstacle, 100);
        return;
    }

    const speed = window.gameConfig.baseSpeed;

    // [수정] 공중(프테라노돈):지상 장애물 등장 비율을 4:6으로 고정.
    // 예전에는 공중 장애물이 "단독 웨이브일 때만 30% 확률"로 나와서 실제 비율이 훨씬
    // 낮았고(팩이 나오면 무조건 지상), 그냥 계속 점프만 해도 되는 쉬운 난이도였다.
    // 이제 웨이브 타입(공중/지상)을 먼저 4:6으로 정하고, 지상일 때만 아래에서
    // 속도 기반 팩(2~3개 묶음) 여부를 추가로 결정한다.
    const AIR_OBSTACLE_RATIO = 0.4;
    const isAirborne = Math.random() < AIR_OBSTACLE_RATIO;

    // 패턴 결정(지상일 때만): 속도 6 이상(3개), 속도 4 이상(2개), 그 외(1개)
    // 팩은 장애물끼리 붙어 있어 점프 한 번으로 전부 넘으므로 공정성에는 영향 없음.
    let count = 1;
    if (!isAirborne) {
        if (speed >= 6 && Math.random() < 0.4) count = 3;
        else if (speed >= 4 && Math.random() < 0.5) count = 2;
    }

    if (isAirborne) {
        obstacles.push(new Obstacle(ctx, 1400, true));
    } else if (count > 1) {
        const types = ['realmetal', 'stone', 'wood'];
        const sharedType = types[Math.floor(Math.random() * types.length)];

        let lastX = 1400;
        for (let i = 0; i < count; i++) {
            const obs = new Obstacle(ctx, lastX, false, sharedType);
            obstacles.push(obs);

            // 다음 장애물 위치 계산 (이미지 로드 전후 고려)
            const obsWidth = (obs.image && obs.image.width > 0) ? obs.width : (150 * 0.45);
            lastX += obsWidth;
        }
    } else {
        obstacles.push(new Obstacle(ctx, 1400, false));
    }

    // 장애물 개수에 따른 안전거리 보정
    const packBonus = (count - 1) * 250;
    const safetyDistance = Math.max(700, 1100 - (speed * 40)) + packBonus;
    const nextSpawnTime = Math.max(900, safetyDistance / speed);

    obstacleTimeout = setTimeout(spawnObstacle, nextSpawnTime + Math.random() * 300);
}

// 5. 충돌 감지 로직 (축소된 hitboxWidth 및 hitboxHeight 반영 연산)
function checkCollision(dino, obs) {
    const dinoActualY = dino.y - dino.bounce;

    // 장애물 파일 안의 draw() 정렬 계산식과 매칭되는 실제 히트박스 좌표 도출
    const xDiff = (obs.width - obs.hitboxWidth) / 2;
    const obsHitboxX = obs.x + xDiff;

    const yDiff = obs.height - obs.hitboxHeight;
    const obsHitboxY = obs.y - obs.height + obs.yOffset + yDiff;

    return (
        dino.x + dino.hitboxOffset.x < obsHitboxX + obs.hitboxWidth &&
        dino.x + dino.hitboxOffset.x + dino.width > obsHitboxX &&
        dinoActualY + dino.hitboxOffset.y < obsHitboxY + obs.hitboxHeight &&
        dinoActualY + dino.hitboxOffset.y + dino.height > obsHitboxY
    );
}

// 7. 로딩 확인
const loadStartTime = Date.now();
const LOAD_TIMEOUT_MS = 10000; // [수정] 에셋 하나라도 실패하면 무한 로딩에 걸리므로 10초 안전장치 추가

const checkLoad = setInterval(() => {
    const spritesLoaded = Object.values(spriteCache).every(img => {
        if (Array.isArray(img)) return img.every(i => i.complete);
        return img.complete;
    });

    const allReady = Object.values(dinoParts).every(img => img.complete) && spritesLoaded && background.isLoaded();
    const timedOut = Date.now() - loadStartTime > LOAD_TIMEOUT_MS;

    if (allReady || timedOut) {
        clearInterval(checkLoad);
        if (timedOut && !allReady) {
            console.error("[Loading] 일부 에셋이 시간 내에 로드되지 않았습니다. 콘솔의 개별 경고를 확인하세요. 게임은 계속 진행됩니다.");
        }
        dino = new Dino(ctx, dinoParts);
        assetsReady = true;
        console.log("로딩 완료: 홈 화면 대기");

        // [신규] 로딩 중에 플레이 버튼을 눌러 로딩 화면이 떠 있었다면, 추가 클릭 없이
        // 지금 바로 게임을 시작한다.
        if (pendingStart) {
            pendingStart = false;
            reallyStartGame();
        }
    }
}, 100);

// 8. 메인 루프
function gameLoop(timestamp) {
    if (!isLoopRunning && (document.getElementById('gameScreen').classList.contains('hidden') || isPaused)) {
        return;
    }

    isLoopRunning = true;

    if (isPaused) {
        isLoopRunning = false;
        return;
    }

    // [신규] 이번 프레임에 적용할 델타타임 배율(주사율 정규화). 자세한 설명은 위쪽
    // FRAME_REFERENCE_MS 선언부 주석 참고.
    const deltaFactor = computeDeltaFactor(timestamp);

    if (isGameOver) {
        // 어둠 처리는 drawGameOverSequence 내부에서 background.getDarknessAlpha()로 일관되게 적용됨
        drawGameOverSequence(ctx, canvas, background, obstacles, deltaFactor);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (window.gameConfig.baseSpeed < window.gameConfig.maxSpeed) {
        window.gameConfig.baseSpeed += 0.0004 * deltaFactor;
    }

    // 이동 거리만큼 현재 기록 누적 (죽으면 이 블록에 도달하지 않으므로 자동으로 멈춤)
    currentScore += window.gameConfig.baseSpeed * deltaFactor * METERS_PER_PIXEL;
    updateScoreUI();

    // [신규] 점수 2만(미터) 돌파 시 배경음악을 서서히 아레나 트랙으로 전환 (판당 한 번만)
    if (!arenaBgmTriggered && currentScore >= ARENA_BGM_SCORE_THRESHOLD) {
        arenaBgmTriggered = true;
        if (typeof fadeToArenaBgm === 'function') fadeToArenaBgm();
    }

    if (dino) dino.update(deltaFactor);
    background.update(deltaFactor);

    if (dino && dino.y >= window.gameConfig.groundY && jumpBufferTime > 0) {
        if (Date.now() - jumpBufferTime <= JUMP_BUFFER_MS) {
            dino.jump();
        }
        jumpBufferTime = 0;
    }

    // A. 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // B. 배경 그리기 (달 포함)
    background.draw();

    // C. 장애물 및 공룡 그리기
    // [수정] 배경(레이어)은 기본 강도(1.5)로 어두워지지만, 장애물/공룡은 달처럼 시야 확보를
    // 위해 더 약한 강도(1.0)로만 어두워지도록 함. 예전엔 ctx.filter='brightness(...)'로
    // 처리했는데, 캔버스 필터가 켜진 상태에서 그려지는 drawImage마다 비용이 커서(장애물+공룡
    // 파츠 합쳐 한 프레임에 여러 번) 밤에 프레임 드랍이 심해지는 주된 원인이었다. 이제
    // getDarknessAlpha(1.0)로 얻은 알파값을 각 draw()에 넘겨서, 그린 이미지 위에 반투명
    // 검은 사각형을 덧칠하는 방식(단순 알파 블렌딩, 훨씬 저렴함)으로 어둡게 한다. 계산 공식은
    // 여전히 getDarknessAlpha() 한 곳에서만 관리되므로 게임오버 연출(gameover.js)과도 항상
    // 같은 결과를 보장함.
    const fgDarknessAlpha = background.getDarknessAlpha(1.0);

    obstacles = obstacles.filter(obs => {
        // [수정] 한 프레임에서 이미 충돌/게임오버가 확정되면 나머지 장애물은 더 이상
        // 갱신/충돌판정하지 않음 (죽는 순간 이후에도 장애물이 계속 움직이거나
        // gameOver()가 여러 번 중복 호출되던 문제 방지)
        if (isGameOver) return true;

        obs.update(deltaFactor);
        obs.draw(fgDarknessAlpha);
        if (dino && checkCollision(dino, obs)) {
            gameOver();
            return true;
        }
        return obs.x + obs.width > 0;
    });

    if (dino) dino.draw(fgDarknessAlpha);

    requestAnimationFrame(gameLoop);
}

// [수정] 플레이 버튼이 눌렸을 때: 설정을 열어둔 채로 플레이했다면 다음에 홈으로 돌아왔을 때도
// 열려있던 문제를 막기 위해 항상 닫고 시작한다. 에셋 로딩이 아직 안 끝났으면(assetsReady가
// false) 바로 게임을 시작하지 않고 로딩 화면을 띄운 뒤, checkLoad가 로딩 완료를 감지하는
// 즉시(추가 클릭 없이) reallyStartGame()을 대신 호출해준다.
function startGameFromHome() {
    // [신규] 시작 전용 알림음 (다른 버튼들의 공통 클릭음과 구분됨 - js/audio.js 참고)
    if (typeof playStartClickSfx === 'function') playStartClickSfx();

    closeSettings();
    closeRanking();

    if (!assetsReady) {
        pendingStart = true;
        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('loadingScreen').classList.remove('hidden');
        return;
    }

    reallyStartGame();
}

// 실제 게임 시작 로직 (기존 startGameFromHome의 본문). 로딩 화면에서 자동으로 넘어올 때도
// 호출되므로, 로딩 화면이 떠 있었을 경우까지 대비해 loadingScreen도 함께 숨긴다.
function reallyStartGame() {
    // 1. 레이어 전환
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

    // 2. 인게임 데이터 상태 완전 초기화
    if (typeof resetGameOverState === 'function') resetGameOverState();
    isPaused = false;
    isInputActive = false;
    window.gameConfig.baseSpeed = 2;
    obstacles = [];
    currentScore = 0;
    updateScoreUI();
    arenaBgmTriggered = false; // [신규] 새 판이니 아레나 배경음악 전환 여부도 리셋
    if (typeof playGameBgm === 'function') playGameBgm(); // [신규] 인게임 배경음악 재생
    if (background && typeof background.reset === 'function') {
        background.reset();
    }
    jumpBufferTime = 0;

    // 5. 공룡 인스턴스를 새롭게 생성하여 잔존 물리 데이터 완벽 초기화
    if (dinoParts) {
        dino = new Dino(ctx, dinoParts);
    }

    // [신규] 랭킹 시스템: 서버 기준 시작 시각을 기록해 토큰을 받아둔다(js/leaderboard.js).
    // Supabase가 아직 설정 안 됐으면 이 함수는 아무것도 하지 않고 조용히 반환된다.
    if (typeof startRunSession === 'function') startRunSession();

    // 3. 타이머 청소 후 장애물 생성 및 메인 루프 가동
    if (obstacleTimeout) clearTimeout(obstacleTimeout);
    spawnObstacle();

    // 중복 루프 방지: 기존 루프가 완전히 꺼졌거나 실행 중이 아닐 때만 깨움
    resetFrameTiming(); // 새 판을 델타타임 기준 프레임(deltaFactor=1)부터 시작
    if (!isLoopRunning) {
        requestAnimationFrame(gameLoop);
    }
}
