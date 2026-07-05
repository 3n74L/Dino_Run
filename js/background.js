class Background {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.layers = [
            { img: new Image(), x: 0, multiplier: 0.1, scale: 1, yOffset: -120, drawWidth: 0 },
            { img: new Image(), x: 0, multiplier: 0.3, scale: 0.8, yOffset: 0, drawWidth: 0 },
            { img: new Image(), x: 0, multiplier: 1.0, scale: 1, yOffset: 0, drawWidth: 0 }
        ];

        this.layers.forEach((layer, index) => {
            layer.img.src = `assets/background/layer${index + 1}.png`;
            layer.img.onload = () => {
                const baseScale = this.canvas.height / layer.img.height;
                layer.drawWidth = layer.img.width * baseScale * layer.scale;
            };
            // [수정] 로드 실패 시 무한 대기(로딩화면 멈춤) 방지: 캔버스 너비로 임시 대체
            layer.img.onerror = () => {
                console.warn(`[Background] 레이어${index + 1} 이미지 로드 실패: ${layer.img.src}`);
                layer.drawWidth = this.canvas.width;
            };
        });

        this.sunImg = new Image();
        this.sunImg.src = 'assets/background/sun.png';

        this.rawMoonImg = new Image();
        this.rawMoonImg.src = 'assets/background/moon.png';
        this.moonImg = null;

        this.celestialLoaded = 0;
        this.sunImg.onload = () => this.celestialLoaded++;
        // [수정] 실패해도 로딩이 영원히 멈추지 않도록 카운트는 증가시킴
        this.sunImg.onerror = () => {
            console.warn(`[Background] 태양 이미지 로드 실패: ${this.sunImg.src}`);
            this.celestialLoaded++;
        };

        // [수정] 밝기 보정은 main.js에서 할 것이므로 여기서는 원본 그대로 로드
        this.rawMoonImg.onload = () => {
            this.moonImg = this.rawMoonImg;
            this.celestialLoaded++;
        };
        this.rawMoonImg.onerror = () => {
            console.warn(`[Background] 달 이미지 로드 실패: ${this.rawMoonImg.src}`);
            this.celestialLoaded++;
        };

        this.targetX = 1100;
        this.celestialX = 800;
        this.celestialY = 0;
        this.sunScale = 0.3;
        this.moonScale = 0.45;

        // [수정] 해/달 이동 속도를 기존 대비 20% 감속 (0.096->0.0768, 12->9.6)
        this.celestialSpeedRate = 0.0768;
        this.transitionSpeed = 9.6;
        this.spawnMargin = 15;

        // [신규] 진입(phase_in) 이후 등속 궤도 속도로 자연스럽게 감속하기 위한 값들.
        // 퇴장(phase_out)은 요청대로 그대로 두고, 진입 종료 시점에만 적용.
        this.settleDurationMs = 300; // 감속에 걸리는 시간 (0.3초)
        this.settleStartTime = 0;
        this.settleStartSpeed = 0;

        this.state = 'day';
        this.dayRGB = { r: 135, g: 206, b: 235 };
        this.nightRGB = { r: 0, g: 0, b: 0 };

        this.currentRGB = { ...this.dayRGB };
        this.targetRGB = { ...this.dayRGB };
        this.colorLerpSpeed = 0.05;
        this.darkness = 0;

        // [수정] 실제 이동 범위(대략 targetX ~ -imgWidth)에 맞춰 궤적 계산 기준값을 보정
        // day/night 상태에서 celestialX가 대략 1100 -> -60 범위로 움직이므로
        // 그 구간의 시작/끝이 sin(0)=0(지평선)에 가깝게 오도록 범위를 재설정
        this.arcRangeStart = 1250; // progress = 0 지점 (지평선 근처, 살짝 여유를 둠)
        this.arcRangeEnd = -150;   // progress = 1 지점 (지평선 근처, 살짝 여유를 둠)
    }

    isLoaded() {
        const layersLoaded = this.layers.every(l => l.drawWidth > 0);
        return layersLoaded && this.celestialLoaded >= 2;
    }

    getCelestialY(x) {
        const total = this.arcRangeStart - this.arcRangeEnd;
        const progress = (this.arcRangeStart - x) / total;
        const clamped = Math.min(1, Math.max(0, progress));

        const baseHeight = 250;  // 하늘 높이(지평선 기준)
        const amplitude = 150;   // 곡선의 깊이

        return baseHeight - (Math.sin(clamped * Math.PI) * amplitude);
    }

    // [수정] deltaFactor(기본 1): 주사율 정규화 델타타임 배율. main.js의 FRAME_REFERENCE_MS
    // 설명 참고. 240Hz 모니터에서는 항상 1에 가까워서 기존 동작과 100% 동일하게 유지된다.
    update(deltaFactor = 1) {
        const baseSpeed = window.gameConfig.baseSpeed;
        this.layers.forEach(layer => {
            if (layer.drawWidth === 0) return;
            layer.x -= baseSpeed * layer.multiplier * deltaFactor;
            // [수정] 기존에는 x가 -drawWidth를 넘어가면(오버슈트) 그 초과분을 버리고
            // 그냥 0으로 리셋했음. 평소엔 티가 안 나지만 speed가 커서 한 프레임 이동량이
            // 클수록 오버슈트도 커져서, 리셋 순간 배경이 그만큼 순간적으로 튀며 검은 틈이
            // 잠깐 보이는 원인이 됐다. 0으로 되돌리는 대신 drawWidth를 더해 초과분을 그대로
            // 이어가도록(나머지 보존) 바꿔서 스냅 없이 완전히 매끄럽게 이어지게 함.
            if (layer.x <= -layer.drawWidth) layer.x += layer.drawWidth;
        });

        // 천체 크기 계산 최적화
        const isSun = this.state.includes('sun') || this.state === 'day';
        // [수정] moonImg가 아직 로드되지 않았을 수 있으므로 안전하게 가드
        const imgWidth = (isSun
            ? this.sunImg.width * this.sunScale
            : (this.moonImg ? this.moonImg.width * this.moonScale : 0)) || 50;

        // 타겟 RGB 설정 (객체 재할당 방지)
        const target = isSun ? this.dayRGB : this.nightRGB;
        this.targetRGB.r = target.r;
        this.targetRGB.g = target.g;
        this.targetRGB.b = target.b;

        // 상태 관리 스위치문 (로직 유지)
        switch (this.state) {
            case 'day':
                this.celestialX -= baseSpeed * this.celestialSpeedRate * deltaFactor;
                if (this.celestialX + imgWidth <= 10) this.state = 'sun_phase_out';
                break;
            case 'sun_phase_out':
                this.celestialX -= this.transitionSpeed * deltaFactor;
                if (this.celestialX + imgWidth < -300) {
                    this.state = 'moon_phase_in';
                    this.celestialX = 1500;
                }
                break;
            case 'moon_phase_in':
                this.celestialX -= this.transitionSpeed * deltaFactor;
                if (this.celestialX <= this.targetX) {
                    this.celestialX = this.targetX;
                    // [수정] 바로 'night'로 가지 않고, 0.3초짜리 감속 구간을 거침
                    this.state = 'moon_settling';
                    this.settleStartTime = Date.now();
                    this.settleStartSpeed = this.transitionSpeed;
                }
                break;
            case 'moon_settling': {
                const targetSpeed = baseSpeed * this.celestialSpeedRate;
                const t = Math.min(1, (Date.now() - this.settleStartTime) / this.settleDurationMs);
                const eased = 1 - Math.pow(1 - t, 3); // ease-out: 처음엔 그대로, 끝에서 부드럽게 목표 속도로 수렴
                const currentSpeed = this.settleStartSpeed + (targetSpeed - this.settleStartSpeed) * eased;
                this.celestialX -= currentSpeed * deltaFactor;
                if (t >= 1) this.state = 'night';
                break;
            }
            case 'night':
                this.celestialX -= baseSpeed * this.celestialSpeedRate * deltaFactor;
                if (this.celestialX + imgWidth <= 10) this.state = 'moon_phase_out';
                break;
            case 'moon_phase_out':
                this.celestialX -= this.transitionSpeed * deltaFactor;
                if (this.celestialX + imgWidth < -this.spawnMargin) {
                    this.state = 'sun_phase_in';
                    this.celestialX = 1200;
                }
                break;
            case 'sun_phase_in':
                this.celestialX -= this.transitionSpeed * deltaFactor;
                if (this.celestialX <= this.targetX) {
                    this.celestialX = this.targetX;
                    // [수정] 바로 'day'로 가지 않고, 0.3초짜리 감속 구간을 거침
                    this.state = 'sun_settling';
                    this.settleStartTime = Date.now();
                    this.settleStartSpeed = this.transitionSpeed;
                }
                break;
            case 'sun_settling': {
                const targetSpeed = baseSpeed * this.celestialSpeedRate;
                const t = Math.min(1, (Date.now() - this.settleStartTime) / this.settleDurationMs);
                const eased = 1 - Math.pow(1 - t, 3);
                const currentSpeed = this.settleStartSpeed + (targetSpeed - this.settleStartSpeed) * eased;
                this.celestialX -= currentSpeed * deltaFactor;
                if (t >= 1) this.state = 'day';
                break;
            }
        }

        // 색상 보간 및 어둠 값 계산
        // [수정] colorLerpSpeed는 "매 프레임 남은 차이의 5%만큼 좁힌다"는 지수 감쇠 방식이라,
        // deltaFactor를 그냥 곱하면(특히 deltaFactor가 클 때) 한 번에 100%를 넘겨 되튀는
        // 등 불안정해질 수 있다. 지수 감쇠를 가변 시간 간격에 맞게 정확히 일반화하는
        // 공식(1 - (1-rate)^deltaFactor)을 사용해 몇 배속이 되든 항상 0~1 사이로 안정적으로
        // 수렴하게 한다.
        const rgbLerpFactor = 1 - Math.pow(1 - this.colorLerpSpeed, deltaFactor);
        this.currentRGB.r += (this.targetRGB.r - this.currentRGB.r) * rgbLerpFactor;
        this.currentRGB.g += (this.targetRGB.g - this.currentRGB.g) * rgbLerpFactor;
        this.currentRGB.b += (this.targetRGB.b - this.currentRGB.b) * rgbLerpFactor;

        this.darkness = ((this.dayRGB.r - this.currentRGB.r) / (this.dayRGB.r - this.nightRGB.r || 1)) * 0.40;
    }

    // [핵심 수정] 어둠 필터 계산을 이 함수 하나로 통합.
    // background.js 내부, main.js, gameover.js가 전부 이 함수만 호출하도록 해서
    // "필터 계산이 두 곳에 따로 있어서 한쪽만 적용되는" 문제(게임오버 필터 버그)의 재발을 원천 차단.
    // [수정] intensityMultiplier를 인자로 받도록 확장. 배경 레이어는 기존과 동일하게 1.5(기본값)를
    // 쓰고, 공룡/장애물은 달만 원본 색을 유지하는 것과 비슷하게 밤에도 시야가 덜 어두워야 해서
    // main.js/gameover.js에서 더 약한 값(1.0)으로 호출한다. 계산 공식 자체는 한 곳(이 함수)에만
    // 있으므로 "필터 계산이 여러 곳에 흩어지는" 문제는 여전히 생기지 않는다.
    getFilterString(intensityMultiplier = 1.5) {
        if (this.darkness <= 0.01) return 'none';
        const brightness = Math.max(0.3, 1 - (this.darkness * intensityMultiplier));
        return `brightness(${brightness})`;
    }

    draw() {
        this.ctx.fillStyle = `rgb(${Math.round(this.currentRGB.r)}, ${Math.round(this.currentRGB.g)}, ${Math.round(this.currentRGB.b)})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawCelestial();

        this.ctx.filter = this.getFilterString();
        this.layers.forEach(l => {
            if (l.drawWidth === 0) return;
            this.ctx.drawImage(l.img, l.x, l.yOffset, l.drawWidth, this.canvas.height * l.scale);
            // [수정] 두 번째 타일을 1px 앞당겨서 살짝 겹치게 그림. 같은 이미지를 겹쳐 그리는
            // 것이라 육안으로는 차이가 없지만, x가 소수점 좌표일 때 캔버스가 두 drawImage
            // 호출을 각각 다른 정수 픽셀로 반올림하면서 생길 수 있는 미세한 서브픽셀 틈을
            // 안전하게 방지한다.
            this.ctx.drawImage(l.img, l.x + l.drawWidth - 1, l.yOffset, l.drawWidth, this.canvas.height * l.scale);
        });
        this.ctx.filter = 'none';
    }

    // [핵심] main.js에서 달을 따로 그릴 수 있도록 좌표/이미지 정보 반환 메서드 추가
    drawCelestial() {
        if (this.state === 'day' || this.state === 'sun_phase_out' || this.state === 'sun_phase_in' || this.state === 'sun_settling') {
            const w = this.sunImg.width * this.sunScale;
            const h = this.sunImg.height * this.sunScale;
            this.ctx.drawImage(this.sunImg, this.celestialX, this.celestialY, w, h);
        } else if ((this.state === 'night' || this.state === 'moon_phase_out' || this.state === 'moon_phase_in' || this.state === 'moon_settling') && this.moonImg) {
            const w = this.moonImg.width * this.moonScale;
            const h = this.moonImg.height * this.moonScale;
            this.ctx.drawImage(this.moonImg, this.celestialX, this.celestialY, w, h);
        }
    }

    reset() {
        this.celestialX = 800;
        this.state = 'day';
        this.currentRGB = { ...this.dayRGB };
        this.targetRGB = { ...this.dayRGB };
        this.darkness = 0;
        this.layers.forEach(layer => {
            layer.x = 0;
        });
    }
}