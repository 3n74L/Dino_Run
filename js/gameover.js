// 게임오버 연출용 변수 및 캐시
const cemeteryImg = new Image();
cemeteryImg.src = 'assets/sprites/Cemetery.png';
cemeteryImg.onerror = () => console.warn(`[GameOver] 무덤 이미지 로드 실패: ${cemeteryImg.src}`);

let isGameOver = false;
let showCemetery = false;
let cemeteryX = 0;
let cemeteryScale = 0;

let diePhase = 'alive';
let delayTimer = 0;
let dinoDieAngle = 0;
let dinoDieVy = 0;
let dinoDieY = 0;
let dinoDieX = 0;

// 게임 오버 로직 시작 트리거
function gameOver() {
    isGameOver = true;
    diePhase = 'hitDelay';
    delayTimer = Date.now();

    dinoDieY = dino.y - dino.bounce;
    dinoDieX = dino.x;
    dinoDieAngle = 0;
}

// 루프 내에서 호출될 게임오버 렌더링 연출 함수
function drawGameOverSequence(ctx, canvas, background, obstacles) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();

    // [핵심 버그 수정]
    // 기존에는 여기서 밤/밝기 필터를 전혀 설정하지 않아서, 배경만 어두워지고
    // 장애물/공룡은 이전 프레임에 남아있던 필터 상태(대부분 'none')로 그려졌습니다.
    // background.getFilterString()을 호출해 게임 진행 중과 완전히 동일한 밝기 필터를
    // 장애물과 공룡에도 적용합니다.
    ctx.filter = background.getFilterString();

    obstacles.forEach(obs => obs.draw());

    // 1단계: 닿는 순간 그 좌표 그대로 정지 (150ms 동안 멈춤)
    if (diePhase === 'hitDelay') {
        if (Date.now() - delayTimer > 150) {
            diePhase = 'spinning';
            dinoDieVy = -5;
        }

        ctx.save();
        const originalY = dino.y;
        const originalBounce = dino.bounce;
        dino.x = dinoDieX;
        dino.y = dinoDieY;
        dino.bounce = 0;
        dino.draw();
        dino.y = originalY;
        dino.bounce = originalBounce;
        ctx.restore();
    }
    // 2단계: 위로 살짝 튀어올랐다가 천천히 회전하면서 낙하
    else if (diePhase === 'spinning') {
        dinoDieVy += 0.25;
        dinoDieY += dinoDieVy;
        dinoDieAngle -= 5;

        if (dinoDieY >= window.gameConfig.groundY) {
            dinoDieY = window.gameConfig.groundY;
            diePhase = 'buried';
            showCemetery = true;
            cemeteryX = dinoDieX;
            cemeteryScale = 0.05;

            setTimeout(() => {
                const gameOverOverlay = document.getElementById('gameOverOverlay');
                gameOverOverlay.classList.remove('hidden');
                void gameOverOverlay.offsetWidth;
                gameOverOverlay.classList.add('show');
            }, 1000);
        }

        ctx.save();
        const centerX = dinoDieX + (dino.width / 2) + dino.hitboxOffset.x;
        const centerY = dinoDieY + (dino.height / 2) + dino.hitboxOffset.y;
        ctx.translate(centerX, centerY);
        ctx.rotate(dinoDieAngle * Math.PI / 180);
        ctx.translate(-centerX, -centerY);

        const originalY = dino.y;
        const originalBounce = dino.bounce;
        dino.x = dinoDieX;
        dino.y = dinoDieY;
        dino.bounce = 0;
        dino.draw();

        dino.y = originalY;
        dino.bounce = originalBounce;
        ctx.restore();
    }
    // 3단계: 무덤 생성 및 확장
    else if (diePhase === 'buried') {
        if (showCemetery && cemeteryScale < 0.45) {
            cemeteryScale += 0.03;
            if (cemeteryScale > 0.45) cemeteryScale = 0.45;
        }

        if (showCemetery && cemeteryImg.complete) {
            const dw = cemeteryImg.width * cemeteryScale;
            const dh = cemeteryImg.height * cemeteryScale;
            const renderX = Math.floor(cemeteryX + 25 - dw / 2);
            const renderY = Math.floor(window.gameConfig.groundY + 80 - dh);
            ctx.drawImage(cemeteryImg, renderX, renderY, dw, dh);
        }
    }

    // [수정] 이 함수 안에서 켠 필터는 반드시 여기서 끝에 다시 꺼줘야
    // 다음 프레임(혹은 오버레이 UI 등)에 의도치 않게 영향이 남지 않습니다.
    ctx.filter = 'none';
}

// 신규 추가: 새로고침 없이 상태를 리셋하는 함수
function resetGameOverState() {
    isGameOver = false;
    showCemetery = false;
    cemeteryX = 0;
    cemeteryScale = 0;
    diePhase = 'alive';
    delayTimer = 0;
    dinoDieAngle = 0;
    dinoDieVy = 0;
    dinoDieY = 0;
    dinoDieX = 0;
}
