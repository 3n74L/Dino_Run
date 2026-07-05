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

    // [신규] 게임오버 효과음
    if (typeof playGameOverSfx === 'function') playGameOverSfx();

    // 최종 기록 확정 및 최고 기록 갱신 (currentScore/bestScore는 main.js에서 관리)
    const finalScore = Math.floor(currentScore);
    if (finalScore > bestScore) {
        bestScore = finalScore;
        localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(bestScore));
        // [신규] 최고 기록 경신 효과음 (게임오버 효과음과 별개로 같이 재생됨)
        if (typeof playNewBestSfx === 'function') playNewBestSfx();
    }
    const finalScoreText = document.getElementById('finalScoreText');
    if (finalScoreText) finalScoreText.innerText = `${finalScore}M`;
    updateScoreUI();

    // [신규] 랭킹 서버에 최종 기록 제출 (js/leaderboard.js). Supabase가 아직 설정 안 됐거나
    // 이번 판이 start-run 없이 시작됐으면 이 함수는 아무것도 하지 않고 조용히 반환된다.
    if (typeof submitScoreToLeaderboard === 'function') {
        const nickname = (typeof nicknameInput !== 'undefined' && nicknameInput) ? nicknameInput.value : '';
        submitScoreToLeaderboard(nickname, finalScore);
    }
}

// 루프 내에서 호출될 게임오버 렌더링 연출 함수
// [수정] deltaFactor(기본 1): 주사율 정규화 델타타임 배율(main.js 참고). 사망 연출
// (튀어오름/회전/무덤 확장)도 매 프레임 고정량으로 움직이던 부분이라, 저주사율 기기에서
// 이 연출만 유독 느리게 보이지 않도록 동일하게 적용한다.
function drawGameOverSequence(ctx, canvas, background, obstacles, deltaFactor = 1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();

    // [핵심 버그 수정]
    // 기존에는 여기서 밤/밝기 처리를 전혀 안 해서, 배경만 어두워지고 장애물/공룡은
    // 이전 프레임에 남아있던 필터 상태(대부분 'none')로 그려졌습니다.
    // background.getDarknessAlpha()로 게임 진행 중과 완전히 동일한 어둠 정도를 계산해
    // 장애물과 공룡에도 적용합니다. (약한 강도(1.0)는 main.js의 게임 루프와 동일하게 맞춤)
    // [수정] ctx.filter='brightness(...)' 대신 각 draw()가 반투명 검은 사각형을 덧칠하는
    // 방식으로 바뀌어서(성능 최적화, SETTINGS.md 참고), 여기서 필터를 켜고 끌 필요가 없어짐.
    const darknessAlpha = background.getDarknessAlpha(1.0);

    obstacles.forEach(obs => obs.draw(darknessAlpha));

    // 1단계: 닿는 순간 그 좌표 그대로 정지 (150ms 동안 멈춤)
    if (diePhase === 'hitDelay') {
        if (Date.now() - delayTimer > 150) {
            diePhase = 'spinning';
            dinoDieVy = -5;
        }

        ctx.save();
        const originalX = dino.x;
        const originalY = dino.y;
        const originalBounce = dino.bounce;
        dino.x = dinoDieX;
        dino.y = dinoDieY;
        dino.bounce = 0;
        dino.draw(darknessAlpha);
        dino.x = originalX;
        dino.y = originalY;
        dino.bounce = originalBounce;
        ctx.restore();
    }
    // 2단계: 위로 살짝 튀어올랐다가 천천히 회전하면서 낙하
    else if (diePhase === 'spinning') {
        dinoDieVy += 0.25 * deltaFactor;
        dinoDieY += dinoDieVy * deltaFactor;
        dinoDieAngle -= 5 * deltaFactor;

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

        const originalX = dino.x;
        const originalY = dino.y;
        const originalBounce = dino.bounce;
        dino.x = dinoDieX;
        dino.y = dinoDieY;
        dino.bounce = 0;
        dino.draw(darknessAlpha);

        dino.x = originalX;
        dino.y = originalY;
        dino.bounce = originalBounce;
        ctx.restore();
    }
    // 3단계: 무덤 생성 및 확장
    else if (diePhase === 'buried') {
        if (showCemetery && cemeteryScale < 0.45) {
            cemeteryScale += 0.03 * deltaFactor;
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
