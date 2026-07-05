// 오디오 재생 관리. 설정의 소리 on/off(main.js의 isAudioOn)를 그대로 따라간다.
// 효과음(sfx)은 매번 새로 재생, 배경음악(bgm)은 한 번에 한 트랙만 반복 재생되도록
// switchBgm()이 이전 트랙을 확실히 멈추고 넘어간다.

// [수정] 배경음악 두 개가 전혀 안 들리는 버그가 있었다. 원인으로 의심되는 부분: 페이지가
// 로드되자마자(사용자 제스처 전) switchBgm()이 곧바로 .play()를 시도했었는데, 브라우저의
// 자동재생 제한 때문에 이 첫 시도가 거부되고, 이후 같은 오디오 엘리먼트에 대한 재생 시도가
// 계속 조용히 씹히는 것처럼 보였다. 이제는 사용자가 페이지와 최소 한 번 상호작용
// (hasUserGesture)하기 전에는 배경음악 쪽에서 절대로 .play()를 호출하지 않고, 그 대신
// 클릭/키/터치가 있을 때마다(한 번만이 아니라 매번) "재생되어야 하는데 멈춰있다면" 다시
// 재생을 시도하는 방식으로 바꿔서, 어떤 이유로 한 번 막히더라도 다음 상호작용에서 계속
// 스스로 복구를 시도하게 했다.
let hasUserGesture = false;

// [수정] 버튼 클릭음을 Web Audio API GainNode로 증폭했었는데, AudioContext가 'suspended'
// 상태에서 resume()이 비동기로 처리되는 타이밍 때문에 일부 환경(실제 배포된 사이트의 크롬)
// 에서 소리가 아예 안 들리는 문제가 있었다. 신뢰성이 더 중요해서 증폭은 포기하고 일반
// <audio> 재생(최대 볼륨 1)으로 되돌림.
const sfx = {
    startClick: new Audio('audio/notification.ogg'),
    buttonClick: new Audio('audio/button%20click.ogg'),
    gameOver: new Audio('audio/Occupy.ogg'),
    newBest: new Audio('audio/purchase.ogg')
};
sfx.buttonClick.volume = 1; // 이미 최대치지만, "더 키워달라"는 요청에 대한 답이 이 값이 한계임을 명시

const BGM_VOLUME = 0.6; // [수정] 배경음악 2개(홈/인게임) 전부 60% 음량으로

const homeBgm = new Audio('audio/TribeFieldBGM.ogg');
const gameBgm = new Audio('audio/HomeBGM.ogg');
const arenaBgm = new Audio('audio/TribeArenaBGM.ogg');
[homeBgm, gameBgm, arenaBgm].forEach(track => {
    track.loop = true;
    track.onerror = () => console.warn(`[Audio] 배경음악 로드 실패: ${track.src}`);
});

let currentBgm = null; // 지금 재생 "되어야 하는" 배경음악 트랙(소리가 꺼져있어도 추적은 계속함)
let bgmFadeInterval = null;

function playSfx(audio) {
    if (!isAudioOn) return;
    audio.currentTime = 0;
    audio.play().catch(() => {}); // 자동재생 제한 등으로 재생이 막혀도 조용히 무시
}

function playStartClickSfx() { playSfx(sfx.startClick); }
function playButtonClickSfx() { playSfx(sfx.buttonClick); }
function playGameOverSfx() { playSfx(sfx.gameOver); }
function playNewBestSfx() { playSfx(sfx.newBest); }

// 배경음악 트랙 전환: 진행 중이던 페이드가 있으면 취소하고, 이전 트랙은 멈춘 뒤 되감는다.
// 사용자 제스처가 아직 없었다면(hasUserGesture=false) .play()를 아예 시도하지 않고 상태만
// 갱신해둔다 - 첫 상호작용 시 ensureBgmPlaying()이 그때 재생을 시작해준다.
function switchBgm(nextTrack) {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    if (currentBgm && currentBgm !== nextTrack) {
        currentBgm.pause();
        currentBgm.currentTime = 0;
    }
    currentBgm = nextTrack;
    currentBgm.volume = BGM_VOLUME;
    if (isAudioOn && hasUserGesture) {
        currentBgm.play().catch(() => {});
    }
}

function playHomeBgm() { switchBgm(homeBgm); }
function playGameBgm() { switchBgm(gameBgm); }

// [신규] 점수 2만 돌파 시, 지금 재생 중인 배경음악을 서서히 줄이다가 아레나 배경음악으로 교체.
const BGM_FADE_DURATION_MS = 1500;
function fadeToArenaBgm() {
    if (!currentBgm) {
        switchBgm(arenaBgm);
        return;
    }
    const fadingOut = currentBgm;
    const startVolume = fadingOut.volume;
    const steps = 30;
    const stepMs = BGM_FADE_DURATION_MS / steps;
    let step = 0;
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);
    bgmFadeInterval = setInterval(() => {
        step++;
        fadingOut.volume = Math.max(0, startVolume * (1 - step / steps));
        if (step >= steps) {
            clearInterval(bgmFadeInterval);
            bgmFadeInterval = null;
            fadingOut.pause();
            fadingOut.currentTime = 0;
            fadingOut.volume = BGM_VOLUME; // 다음에 다시 쓰일 때를 위해 원상복구
            switchBgm(arenaBgm);
        }
    }, stepMs);
}

// 설정에서 소리를 껐다 켰다 할 때, 지금 재생 "되어야 하는" 배경음악도 같이 멈추거나 재개한다.
function applyAudioOnState() {
    if (!currentBgm) return;
    if (isAudioOn) {
        if (hasUserGesture) currentBgm.play().catch(() => {});
    } else {
        currentBgm.pause();
    }
}

// [수정] 대부분의 브라우저는 사용자가 페이지와 처음 상호작용(클릭/키/터치)하기 전에는
// 자동재생을 막는다. 처음 한 번만 재시도하지 않고, 상호작용이 있을 때마다(그리고 아직
// 재생 중이 아닐 때만) 계속 재생을 시도해서 어떤 이유로든 놓쳤던 재생을 스스로 복구한다.
function ensureBgmPlaying() {
    hasUserGesture = true;
    if (currentBgm && isAudioOn && currentBgm.paused) {
        currentBgm.play().catch(() => {});
    }
}
document.addEventListener('click', ensureBgmPlaying);
document.addEventListener('keydown', ensureBgmPlaying);
document.addEventListener('touchstart', ensureBgmPlaying);

// [신규] "플레이" 버튼(#startBtn)은 시작 전용 알림음(notification.ogg)을 따로 쓰므로,
// 그 외의 모든 <button> 클릭에는 공통 클릭음(button click.ogg)을 재생한다.
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.id === 'startBtn') return;
    playButtonClickSfx();
});
