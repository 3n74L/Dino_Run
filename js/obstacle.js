class Obstacle {
    // forcedType 인자를 추가하여 외부(main.js)에서 재질을 고정할 수 있도록 확장
    constructor(ctx, x, isAirborne = false, forcedType = null) {
        this.ctx = ctx;
        this.x = x;
        this.isAirborne = isAirborne;

        // 1. 크기 설정
        this.scale = isAirborne ? (0.26 + Math.random() * 0.04) : 0.45;
        this.yOffset = 80;

        // 2. 최초 생성 높낮이를 2개로 분리
        if (isAirborne) {
            const isLow = Math.random() < 0.5;
            this.y = isLow ? window.gameConfig.groundY - 50 : window.gameConfig.groundY - 180;
        } else {
            this.y = window.gameConfig.groundY;
        }

        this.frameIndex = 0;
        this.lastFrameTime = Date.now();

        if (isAirborne) {
            this.images = spriteCache['air_obstacle'] || [];

            // 3. 각각의 프테라노돈마다 시작 이미지(프레임) 랜덤 설정
            if (this.images.length > 0) {
                this.frameIndex = Math.floor(Math.random() * this.images.length);
                this.image = this.images[this.frameIndex] || null;
            } else {
                this.image = null;
            }

            this.lastFrameTime = Date.now() - Math.floor(Math.random() * 200);
            this.flapInterval = 180 + Math.random() * 60;
            // 오차범위 ±0.1 ~ ±0.3 속도 편차 적용.
            // [수정] main.js의 PTERA_SLOW_UNLOCK_SCORE(기본 250M) 전까지는 "느림"이 아예
            // 안 나오게 부호를 항상 +로 고정한다(느린 프테라 뒤에 빠른 프테라가 붙어 나오면
            // 점프 시간이 없을 정도로 초반 baseSpeed 기준 편차 비중이 컸던 문제 완화).
            const canBeSlow = currentScore >= PTERA_SLOW_UNLOCK_SCORE;
            const sign = canBeSlow && Math.random() < 0.5 ? -1 : 1;
            this.speedOffset = sign * (0.1 + Math.random() * 0.2);
        } else {
            this.images = [];
            const types = ['realmetal', 'stone', 'wood'];
            // forcedType이 외부에서 주입되면 해당 재질을 그대로 사용하고, 없으면 무작위 선택
            const type = forcedType || types[Math.floor(Math.random() * types.length)];
            const levels = [1, 2, 3];
            const level = levels[Math.floor(Math.random() * levels.length)];
            this.image = spriteCache[`${type}${level}`] || null;

            this.flapInterval = 200;
            this.speedOffset = 0;
        }

        // 기본 이미지 크기 계산
        this.width = this.image ? this.image.width * this.scale : 0;
        this.height = this.image ? this.image.height * this.scale : 0;

        // --- 실질적 충돌 전용 히트박스 치수 초기 설정 ---
        this.hitboxWidth = this.width;
        this.hitboxHeight = this.height;
        this.updateHitboxDimensions();
    }

    // 장애물 특성별 히트박스 크기를 보정하는 내부 메서드
    updateHitboxDimensions() {
        if (!this.image) return;

        if (this.isAirborne) {
            // 날개가 위로 솟구치는 0번 이미지일 때 1번 이미지 크기로 강제 고정
            if (this.frameIndex === 0 && this.images[1]) {
                this.hitboxWidth = this.images[1].width * this.scale;
                this.hitboxHeight = this.images[1].height * this.scale;
            } else {
                this.hitboxWidth = this.image.width * this.scale;
                this.hitboxHeight = this.image.height * this.scale;
            }
            // 고정된 프테라 기준 크기에서 추가로 90% 축소 적용
            this.hitboxWidth *= 0.9;
            this.hitboxHeight *= 0.9;
        } else {
            // 지상 장애물은 전체 크기의 90%로 설정
            this.hitboxWidth = (this.image.width * this.scale) * 0.9;
            this.hitboxHeight = (this.image.height * this.scale) * 0.9;
        }
    }

    // [수정] deltaFactor(기본 1): 주사율 정규화 델타타임 배율. main.js의 FRAME_REFERENCE_MS
    // 설명 참고. 이게 없으면 저주사율 기기(대부분의 폰)에서 이동 속도만 느려지고 생성
    // 간격(setTimeout, 실제 ms 기준)은 그대로라 장애물끼리 겹쳐서 나오는 문제가 있었다.
    update(deltaFactor = 1) {
        this.x -= (window.gameConfig.baseSpeed + this.speedOffset) * deltaFactor;

        if (this.isAirborne && this.images.length > 0) {
            if (Date.now() - this.lastFrameTime > this.flapInterval) {
                this.frameIndex = (this.frameIndex + 1) % this.images.length;
                this.image = this.images[this.frameIndex];
                this.lastFrameTime = Date.now();

                // 프레임 교체 시 실시간 치수 및 히트박스 재계산
                if (this.image && this.image.width > 0) {
                    this.width = this.image.width * this.scale;
                    this.height = this.image.height * this.scale;
                    this.updateHitboxDimensions();
                }
            }
        }
    }

    // [수정] darknessAlpha(기본 0): 밤에 장애물을 살짝 어둡게 하기 위한 값(배경보다는 약하게,
    // background.js의 getDarknessAlpha(1.0) 결과). 처음엔 그린 이미지 위에 반투명 검은
    // 사각형을 그냥 덧칠했는데, 이미지의 투명한 여백까지 네모나게 어두워져 마치 히트박스
    // 표시처럼 보이는 문제가 있었다. 대신 background.js의 getDarkenedSprite()로 실루엣
    // 그대로 어둡게 "구워진" 이미지를 받아와 그걸 그린다(원본의 투명한 여백은 계속 투명).
    draw(darknessAlpha = 0) {
        if (!this.image) return;

        if (this.width === 0 && this.image.width > 0) {
            this.width = this.image.width * this.scale;
            this.height = this.image.height * this.scale;
            this.updateHitboxDimensions();
        }

        // 꿀렁거림 현상을 완전히 잡기 위해 X뿐만 아니라 Y좌표에서도 Math.floor를 제거합니다.
        const renderX = this.x;
        const renderY = this.y - this.height + this.yOffset;

        // 원본 이미지 그리기
        const spriteToDraw = darknessAlpha > 0 ? getDarkenedSprite(this.image, darknessAlpha) : this.image;
        this.ctx.drawImage(spriteToDraw, renderX, renderY, this.width, this.height);

        // --- 변경된 충돌 전용 히트박스 시각화 (빨간색 사각형) ---
        // [수정] 디버그용 히트박스가 항상 켜져 있던 문제 -> gameConfig.debugHitbox일 때만 표시
        if (window.gameConfig && window.gameConfig.debugHitbox) {
            // 가로 중앙 정렬 기준 보정
            const xDiff = (this.width - this.hitboxWidth) / 2;
            const hitboxX = renderX + xDiff;

            // 세로 바닥 정렬 기준 보정
            const yDiff = this.height - this.hitboxHeight;
            const hitboxY = renderY + yDiff;

            this.ctx.save();
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(hitboxX, hitboxY, this.hitboxWidth, this.hitboxHeight);
            this.ctx.restore();
        }
    }
}
