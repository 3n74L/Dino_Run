class Dino {
    constructor(ctx, images) {
        this.ctx = ctx;
        this.images = images;
        this.x = 105;
        this.y = window.gameConfig ? window.gameConfig.groundY : 560;
        this.scale = 0.25;

        this.vy = 0;
        this.gravity = 0.8;
        this.jumpStrength = -15;
        this.isJumping = false;

        // [수정] 점프 물리를 "빠르게 올라가고 느리게 내려오는" 느낌으로 튜닝하기 위한 계수.
        // 값을 바꿔가며 체감을 조절할 수 있도록 상수로 분리해둠 (SETTINGS.md에도 기록).
        this.riseGravityMultiplier = 1.4;  // 상승 구간: 중력을 세게 줘서 스냅감 있게 빨리 정점에 도달
        this.apexGravityMultiplier = 0.1;  // 정점 부근: 살짝 공중에 머무는 느낌
        this.fallGravityMultiplier = 0.55; // 하강 구간: 중력을 약하게 줘서 부드럽고 느리게 낙하
        this.apexVelocityThreshold = 5;    // |vy|가 이 값보다 작으면 "정점 부근"으로 판단

        this.hitboxOffset = { x: 30, y: 10 };
        this.width = 50;
        this.height = 60;

        this.legAngle = 0;
        this.bounce = 0;

        this.parts = {
            Body:    { offset: { x: 0,   y: 0 },   pivot: { x: 0,   y: 0 } },
            Belly:   { offset: { x: 130, y: 100 }, pivot: { x: 0,   y: 0 } },
            R_Arm:   { offset: { x: 230, y: 190 }, pivot: { x: 0,   y: 0 } },
            L_Arm:   { offset: { x: 260, y: 165 }, pivot: { x: 10,  y: 0 } },
            R_Leg:   { offset: { x: 115, y: 200 }, pivot: { x: 50,  y: 20 } },
            L_Leg:   { offset: { x: 190, y: 170 }, pivot: { x: 50,  y: 20 } }
        };
    }

    jump() {
        if (!this.isJumping) {
            this.vy = this.jumpStrength;
            this.isJumping = true;
        }
    }

    // [수정] deltaFactor(기본 1): 기기 주사율에 관계없이 실제 시간 기준으로 동일하게
    // 움직이도록 하는 델타타임 배율. main.js의 FRAME_REFERENCE_MS(240fps 기준) 설명 참고.
    // 240Hz 모니터에서는 deltaFactor가 항상 1에 가까워서 기존 동작과 100% 동일하다.
    //
    // [버그 수정] deltaFactor를 그냥 한 번에 곱해서 적용했더니(예: 60Hz에서 deltaFactor≈4),
    // 저주사율 기기에서 점프 높이/시간이 오히려 훨씬 짧아지는 문제가 있었다. 원인은
    // 상승/정점/하강 구간을 가르는 apexVelocityThreshold(=5, vy가 이 범위 안이면 "정점"으로
    // 판단)가 아주 좁은 창(-5~+5)인데, deltaFactor가 크면 vy가 한 번의 update() 호출 만에
    // 이 창을 훌쩍 건너뛰어버려서(240Hz라면 여러 프레임에 걸쳐 조금씩 통과했을 구간을 60Hz는
    // 한두 번의 큰 스텝으로 관통) 정점에 머무는 실제 시간이 크게 줄어들었다. deltaFactor를
    // "240fps 기준 한 프레임 크기"의 작은 스텝 여러 개로 쪼개 반복 적용하면, 몇 Hz에서
    // 계산하든 항상 똑같이 촘촘한 경로로 정점 구간을 통과하게 되어 문제가 해결된다.
    update(deltaFactor = 1) {
        const steps = Math.max(1, Math.ceil(deltaFactor));
        const stepDelta = deltaFactor / steps;

        for (let i = 0; i < steps; i++) {
            // [수정] 기존에는 하강(vy>0) 시 중력이 2.2배로 붙어서 정점 찍고 순식간에 뚝 떨어졌음.
            // "빠르게 올라가고 느리게 내려오는" 느낌을 위해 상승/정점/하강 3단계로 분리:
            //  1) 상승 중(vy<0)이고 정점 근처가 아니면 -> 중력을 세게(riseGravityMultiplier) 줘서 스냅감 있게 빨리 올라감
            //  2) 정점 근처(|vy|가 작음) -> 중력을 아주 약하게 줘서 살짝 머무름
            //  3) 하강 중(vy>0) -> 중력을 약하게(fallGravityMultiplier) 줘서 천천히, 부드럽게 낙하
            let currentGravity;
            if (Math.abs(this.vy) < this.apexVelocityThreshold) {
                currentGravity = this.gravity * this.apexGravityMultiplier;
            } else if (this.vy < 0) {
                currentGravity = this.gravity * this.riseGravityMultiplier;
            } else {
                currentGravity = this.gravity * this.fallGravityMultiplier;
            }

            this.vy += currentGravity * stepDelta;
            this.y += this.vy * stepDelta;

            const groundLimit = window.gameConfig ? window.gameConfig.groundY : 560;
            if (this.y >= groundLimit) {
                this.y = groundLimit;
                this.vy = 0;
                this.isJumping = false;
            }
        }

        const time = Date.now() / 100;
        this.legAngle = this.isJumping ? 0 : Math.sin(time) * 30;
        this.bounce = this.isJumping ? 0 : Math.abs(Math.sin(time)) * 10;
    }

    // [버그 수정] 기존에는 ctx.setTransform(...)으로 "절대 좌표"를 지정했기 때문에,
    // gameover.js에서 사망 연출 시 걸어둔 회전(ctx.translate->rotate->translate)이
    // 이 함수 호출 순간 통째로 덮어써져서 사라졌음(시계 반대방향 회전 낙하가 안 보이던 원인).
    // -> save/translate/rotate/restore로 "현재 좌표계에 상대적으로" 그리도록 변경.
    // 이렇게 하면 바깥에서 걸어둔 회전(게임오버 스핀 등)이 그대로 유지된 채
    // 그 위에 각 파츠의 자체 회전(다리 움직임 등)이 얹어짐.
    // [수정] darknessAlpha(기본 0): 밤에 공룡을 살짝 어둡게 하기 위한 값(배경보다는 약하게,
    // background.js의 getDarknessAlpha(1.0) 결과). 처음엔 그린 파츠 위에 반투명 검은
    // 사각형을 그냥 덧칠했는데, 파츠 이미지가 회전을 위해 여백을 넉넉히 두고 있어서 그
    // 여백까지 네모나게 어두워져 마치 히트박스 표시처럼 보이는 문제가 있었다. 대신
    // background.js의 getDarkenedSprite()로 실루엣 그대로 어둡게 "구워진" 이미지를 받아와
    // 그걸 그린다(원본 이미지의 투명한 여백은 계속 투명하게 남음).
    drawPart(partName, angle = 0, darknessAlpha = 0) {
        const img = this.images[partName];
        if (!img) return;
        const spriteToDraw = darknessAlpha > 0 ? getDarkenedSprite(img, darknessAlpha) : img;

        const p = this.parts[partName];
        const pivotX = this.x + (p.offset.x + p.pivot.x) * this.scale;
        const pivotY = this.y - this.bounce + (p.offset.y + p.pivot.y) * this.scale;

        this.ctx.save();
        this.ctx.translate(pivotX, pivotY);
        this.ctx.rotate(angle * Math.PI / 180);
        const dx = -(p.pivot.x * this.scale);
        const dy = -(p.pivot.y * this.scale);
        const dw = img.width * this.scale;
        const dh = img.height * this.scale;
        this.ctx.drawImage(spriteToDraw, dx, dy, dw, dh);
        this.ctx.restore();
    }

    draw(darknessAlpha = 0) {
        this.ctx.save();

        this.drawPart('L_Leg', this.legAngle, darknessAlpha);
        this.drawPart('L_Arm', this.legAngle * 0.5, darknessAlpha);
        this.drawPart('Body', 0, darknessAlpha);
        this.drawPart('Belly', 0, darknessAlpha);
        this.drawPart('R_Arm', -this.legAngle * 0.5, darknessAlpha);
        this.drawPart('R_Leg', -this.legAngle, darknessAlpha);

        // [수정] 예전처럼 setTransform(1,0,0,1,0,0)으로 강제 초기화하지 않음.
        // drawPart가 이제 save/restore로 자기 변환을 알아서 정리하기 때문에,
        // 여기서는 draw()가 호출된 시점의 좌표계(바깥 회전 포함)가 그대로 유지된 상태.
        // 히트박스도 그 좌표계 기준으로 그려짐 (평상시엔 항상 identity라 결과는 동일).
        // [수정] this.showHitbox(항상 false로 하드코딩되어 있었음)가 gameConfig.debugHitbox와
        // AND로 묶여 있어서, 설정에서 히트박스를 켜도 공룡 히트박스만 절대 표시되지 않던 버그.
        // obstacle.js와 동일하게 gameConfig.debugHitbox 하나만 기준으로 삼도록 수정.
        if (window.gameConfig && window.gameConfig.debugHitbox) {
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(this.x + this.hitboxOffset.x, this.y - this.bounce + this.hitboxOffset.y, this.width, this.height);
        }

        this.ctx.restore();
    }
}