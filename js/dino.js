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
        this.showHitbox = true;

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

    update() {
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

        this.vy += currentGravity;
        this.y += this.vy;

        const groundLimit = window.gameConfig ? window.gameConfig.groundY : 560;
        if (this.y >= groundLimit) {
            this.y = groundLimit;
            this.vy = 0;
            this.isJumping = false;
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
    drawPart(partName, angle = 0) {
        const img = this.images[partName];
        if (!img) return;

        const p = this.parts[partName];
        const pivotX = this.x + (p.offset.x + p.pivot.x) * this.scale;
        const pivotY = this.y - this.bounce + (p.offset.y + p.pivot.y) * this.scale;

        this.ctx.save();
        this.ctx.translate(pivotX, pivotY);
        this.ctx.rotate(angle * Math.PI / 180);
        this.ctx.drawImage(img, -(p.pivot.x * this.scale), -(p.pivot.y * this.scale), img.width * this.scale, img.height * this.scale);
        this.ctx.restore();
    }

    draw() {
        this.ctx.save();

        this.drawPart('L_Leg', this.legAngle);
        this.drawPart('L_Arm', this.legAngle * 0.5);
        this.drawPart('Body');
        this.drawPart('Belly');
        this.drawPart('R_Arm', -this.legAngle * 0.5);
        this.drawPart('R_Leg', -this.legAngle);

        // [수정] 예전처럼 setTransform(1,0,0,1,0,0)으로 강제 초기화하지 않음.
        // drawPart가 이제 save/restore로 자기 변환을 알아서 정리하기 때문에,
        // 여기서는 draw()가 호출된 시점의 좌표계(바깥 회전 포함)가 그대로 유지된 상태.
        // 히트박스도 그 좌표계 기준으로 그려짐 (평상시엔 항상 identity라 결과는 동일).
        if (this.showHitbox) {
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(this.x + this.hitboxOffset.x, this.y - this.bounce + this.hitboxOffset.y, this.width, this.height);
        }

        this.ctx.restore();
    }
}