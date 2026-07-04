// 1. 캔버스 및 게임 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1200;
canvas.height = 675;
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

window.gameConfig = {
    baseSpeed: 2,
    maxSpeed: 12,
    groundY: 560
};

// 게임 제어 플래그
let isPaused = false;
let isLoopRunning = false;
let isAudioOn = true;
let isInputActive = false;
let obstacleTimeout = null;
let jumpBufferTime = 0;
const JUMP_BUFFER_MS = 150; // 선입력 유효 기간 (0.15초)

// 공통 점프 실행 함수
function handleJump() {
    if (isGameOver || isPaused) return;

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

    // 5. 공룡 인스턴스를 새롭게 생성하여 잔존 물리 데이터 완벽 초기화
    if (dinoParts) {
        dino = new Dino(ctx, dinoParts);
    }

    // 6. 장애물 생성 새 스케줄 시작
    spawnObstacle();

    // 7. 루프가 완전히 끊겼을 때만 안전하게 실행
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

    document.getElementById('gameOverOverlay').classList.remove('show');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');

    // 2. 레이어 전환 (게임 스크린 숨기고 홈 스크린 표시)
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('homeScreen').classList.remove('hidden');
}

function toggleSound() {
    isAudioOn = !isAudioOn;
    const soundBtn = document.getElementById('soundBtn');
    soundBtn.innerText = isAudioOn ? "🔊" : "🔇";
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

    // 패턴 결정: 속도 6 이상(3개), 속도 4 이상(2개), 그 외(1개)
    let count = 1;
    if (speed >= 6 && Math.random() < 0.4) count = 3;
    else if (speed >= 4 && Math.random() < 0.5) count = 2;

    const isAirborne = count === 1 ? Math.random() < 0.3 : false;

    if (count > 1) {
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
        obstacles.push(new Obstacle(ctx, 1400, isAirborne));
    }

    // 장애물 개수에 따른 안전거리 보정
    const packBonus = (count - 1) * 250;
    const safetyDistance = Math.max(700, 1100 - (speed * 40)) + packBonus;
    let nextSpawnTime = Math.max(900, safetyDistance / speed);

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
        console.log("로딩 완료: 홈 화면 대기");
    }
}, 100);

// 8. 메인 루프
function gameLoop() {
    if (!isLoopRunning && (document.getElementById('gameScreen').classList.contains('hidden') || isPaused)) {
        return;
    }

    isLoopRunning = true;

    if (isPaused) {
        isLoopRunning = false;
        return;
    }

    if (isGameOver) {
        // 필터는 drawGameOverSequence 내부에서 background.getFilterString()으로 일관되게 적용됨
        drawGameOverSequence(ctx, canvas, background, obstacles);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (window.gameConfig.baseSpeed < window.gameConfig.maxSpeed) {
        window.gameConfig.baseSpeed += 0.0004;
    }

    if (dino) dino.update();
    background.update();

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

    // C. 장애물 및 공룡 그리기 (필터 적용)
    // [수정] 중복 계산 제거: background.getFilterString()이 background.js의 draw()에서 쓰는 것과
    // 완전히 동일한 공식을 사용하므로, 게임오버 연출과도 항상 같은 결과를 보장함.
    ctx.filter = background.getFilterString();

    obstacles = obstacles.filter(obs => {
        obs.update();
        obs.draw();
        if (dino && checkCollision(dino, obs)) {
            gameOver();
            return true;
        }
        return obs.x + obs.width > 0;
    });

    if (dino) dino.draw();

    // 필터 해제
    ctx.filter = 'none';

    requestAnimationFrame(gameLoop);
}

function startGameFromHome() {
    // 1. 레이어 전환
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

    // 2. 인게임 데이터 상태 완전 초기화
    if (typeof resetGameOverState === 'function') resetGameOverState();
    isPaused = false;
    isInputActive = false;
    window.gameConfig.baseSpeed = 2;
    obstacles = [];
    if (background && typeof background.reset === 'function') {
        background.reset();
    }
    jumpBufferTime = 0;

    // 5. 공룡 인스턴스를 새롭게 생성하여 잔존 물리 데이터 완벽 초기화
    if (dinoParts) {
        dino = new Dino(ctx, dinoParts);
    }

    // 3. 타이머 청소 후 장애물 생성 및 메인 루프 가동
    if (obstacleTimeout) clearTimeout(obstacleTimeout);
    spawnObstacle();

    // 중복 루프 방지: 기존 루프가 완전히 꺼졌거나 실행 중이 아닐 때만 깨움
    if (!isLoopRunning) {
        requestAnimationFrame(gameLoop);
    }
}
