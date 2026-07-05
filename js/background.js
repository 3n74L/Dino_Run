// [신규] 밤에 장애물/공룡을 어둡게 하기 위해 매 프레임 이미지 위에 반투명 사각형을 그냥
// 덧칠하면, 이미지 자체의 투명한 여백(특히 공룡 팔다리는 회전을 위해 캔버스 여백이 넉넉함)
// 까지 네모나게 어두워져서 마치 히트박스 표시처럼 보이는 문제가 있었다. 그 대신 이미지를
// 오프스크린 캔버스에서 딱 한 번 어둡게 "구워서" 캐시해두고, 이후로는 그 결과물을 평범하게
// drawImage하기만 한다. source-atop 합성은 원본 이미지의 알파(투명한 부분)를 그대로
// 존중하므로 실루엣 모양 그대로만 어두워지고 여백은 계속 투명하게 남는다.
// 어둠 정도는 하루 주기 동안 연속적으로 변하므로, 완전히 같은 값이 아니어도 캐시를 재사용할
// 수 있도록 일정 간격(DARKEN_BUCKET)으로 반올림해서 키를 만든다 - 매 프레임 새로 "굽지"
// 않고 어둠 단계가 실제로 눈에 띄게 바뀔 때만 새로 계산한다.
const DARKEN_BUCKET = 0.02;
const darkenedSpriteCache = new Map();

function getDarkenedSprite(img, darknessAlpha) {
    if (!img || darknessAlpha <= 0) return img;
    const bucket = Math.round(darknessAlpha / DARKEN_BUCKET) * DARKEN_BUCKET;
    const key = img.src + '|' + bucket.toFixed(2);

    const cached = darkenedSpriteCache.get(key);
    if (cached) return cached;

    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-atop';
    octx.fillStyle = `rgba(0, 0, 0, ${bucket})`;
    octx.fillRect(0, 0, img.width, img.height);

    darkenedSpriteCache.set(key, off);
    return off;
}

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

    // [핵심 수정] 어둠 정도 계산을 이 함수 하나로 통합.
    // background.js 내부, main.js, gameover.js가 전부 이 함수만 호출하도록 해서
    // "어둠 계산이 여러 곳에 따로 있어서 한쪽만 적용되는" 문제(예전의 게임오버 필터 버그)의
    // 재발을 원천 차단.
    // [수정] 원래는 ctx.filter = 'brightness(...)'로 어둡게 했는데, 캔버스 필터는 그 필터가
    // 켜진 상태에서 그려지는 drawImage 하나하나마다 비용이 커서(배경 레이어 6번 + 장애물 N번
    // + 공룡 파츠 6번, 한 프레임에 10~20번), 밤이 되는 순간 프레임 드랍이 심해지는 원인이
    // 됐다. 특히 baseSpeed가 오르면서 장애물이 팩(2~3개)으로 자주 나올수록 그려야 할 이미지가
    // 늘어나 후반부 밤에 더 심해졌다.
    // brightness(b) 필터는 각 채널값에 b를 곱하는 것과 같고, 이는 "검은색과 (1-b) 비율로
    // 알파 블렌딩"하는 것과 수학적으로 동일하다(검은색은 0이라 원본*(1-alpha) = 원본*b가
    // 되도록 alpha=1-b로 두면 결과가 같음). 그래서 필터 대신 반투명 검은 사각형을 그 위에
    // 살짝 덧칠하는 방식(훨씬 저렴한 단순 알파 블렌딩)으로 바꿨다. 이 함수는 이제 그
    // 알파값을 반환한다.
    getDarknessAlpha(intensityMultiplier = 1.5) {
        if (this.darkness <= 0.01) return 0;
        const brightness = Math.max(0.3, 1 - (this.darkness * intensityMultiplier));
        return 1 - brightness;
    }

    draw() {
        this.ctx.fillStyle = `rgb(${Math.round(this.currentRGB.r)}, ${Math.round(this.currentRGB.g)}, ${Math.round(this.currentRGB.b)})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.layers.forEach(l => {
            if (l.drawWidth === 0) return;
            this.ctx.drawImage(l.img, l.x, l.yOffset, l.drawWidth, this.canvas.height * l.scale);
            // [수정] 두 번째 타일을 1px 앞당겨서 살짝 겹치게 그림. 같은 이미지를 겹쳐 그리는
            // 것이라 육안으로는 차이가 없지만, x가 소수점 좌표일 때 캔버스가 두 drawImage
            // 호출을 각각 다른 정수 픽셀로 반올림하면서 생길 수 있는 미세한 서브픽셀 틈을
            // 안전하게 방지한다.
            this.ctx.drawImage(l.img, l.x + l.drawWidth - 1, l.yOffset, l.drawWidth, this.canvas.height * l.scale);
        });

        // [수정] 배경 레이어만 어둡게(기본 강도 1.5). 반투명 검은 사각형을 레이어 위에
        // 덧칠하는 것이라, 이 뒤에 그려지는 달/해(drawCelestial)는 자연히 영향을 받지
        // 않고 항상 원본 밝기를 유지한다(순서를 바꿔서 달/해를 레이어보다 나중에 그림 -
        // 이전에는 반대 순서였지만 화면상 겹치는 영역이 없어 시각적으로 차이 없음).
        const bgDarknessAlpha = this.getDarknessAlpha(1.5);
        if (bgDarknessAlpha > 0) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${bgDarknessAlpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawCelestial();
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