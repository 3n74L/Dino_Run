// 랭킹 시스템 클라이언트 연동.
// 설계: 클라이언트는 leaderboard 테이블을 "읽기"만 하고, "쓰기"는 오직 Edge Function
// (start-run / submit-score)만 할 수 있다. 클라이언트가 가진 anon key로는 leaderboard에
// 직접 점수를 써넣을 수 없으므로(supabase/schema.sql의 RLS 정책 참고), 개발자도구로
// 점수 변수를 조작해도 실제 랭킹에는 반영되지 않는다. 자세한 설계는 SUPABASE_SETUP.md 참고.
//
// [중요] window.SUPABASE_CONFIG(js/supabase-config.js)가 비어있으면 아래 로직은 전부
// 조용히 비활성화되고 게임 자체는 평소처럼 동작한다. Supabase 프로젝트를 아직 만들지
// 않았어도 게임 플레이에는 전혀 지장이 없다.

const supabaseReady = !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
let supabaseClient = null;
let currentRunToken = null;

if (supabaseReady) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    } else {
        console.warn('[Leaderboard] supabase-js 라이브러리를 찾을 수 없습니다. index.html의 CDN 스크립트 태그를 확인하세요.');
    }
}

// 로그인 시스템이 없어서 "한 사람"을 구분할 방법이 닉네임 문자열밖에 없으면, 서로 다른
// 사람이 같은 닉네임을 쓸 때 기록이 섞여버린다. 그래서 브라우저마다 임의의 UUID를 하나
// 만들어 localStorage에 저장해두고, 이 값을 "한 사람"의 식별자로 사용한다(로그인 아님,
// 그냥 이 브라우저의 최고 기록을 계속 갱신하기 위한 키).
const DEVICE_ID_STORAGE_KEY = 'dinoRunDeviceId';
function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
        id = (window.crypto && typeof window.crypto.randomUUID === 'function')
            ? window.crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
}

// 게임 시작 시 호출: 서버(DB) 시계 기준으로 이 판의 시작 시각을 기록해 토큰을 받는다.
// submit-score가 이 토큰으로 "제출된 점수가 경과 시간 안에서 가능한 값인지" 검증한다.
async function startRunSession() {
    currentRunToken = null;
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient.functions.invoke('start-run', { body: {} });
        if (error) throw error;
        currentRunToken = data.token;
    } catch (err) {
        console.warn('[Leaderboard] start-run 호출 실패(이번 판은 랭킹 등록 없이 진행됩니다):', err);
    }
}

// 게임오버 시 호출: 최종 점수를 서버로 보내 검증 후 기록한다.
// [수정] 예전엔 토큰이 없으면 아무 로그도 없이 조용히 리턴해서, restartGame()이
// startRunSession()을 호출하지 않던 버그(홈으로 안 돌아가고 재시작만 누르면 두 번째
// 판부터 기록이 랭킹에 등록되지 않던 문제)를 콘솔로도 알아채기 어려웠다. 이제 토큰이 없는
// 경우를 콘솔 경고로 남겨서, 앞으로 비슷한 문제가 생겨도 F12 콘솔에서 바로 확인 가능하다.
async function submitScoreToLeaderboard(nickname, score) {
    if (!supabaseClient) return;
    if (!currentRunToken) {
        console.warn('[Leaderboard] 제출용 토큰이 없어 이번 판 기록을 랭킹에 올리지 못했습니다. (startRunSession()이 호출됐는지 확인)');
        return;
    }

    // 설정 화면 안내 문구("히트박스를 켜면 랭킹에 등록되지 않습니다")를 실제로 강제하는 부분.
    if (window.gameConfig && window.gameConfig.debugHitbox) {
        currentRunToken = null;
        return;
    }

    const tokenToUse = currentRunToken;
    currentRunToken = null; // 같은 판을 두 번 제출하지 못하도록 즉시 소진 처리

    try {
        const { error } = await supabaseClient.functions.invoke('submit-score', {
            body: { token: tokenToUse, nickname: nickname || '익명', score, deviceId: getOrCreateDeviceId() }
        });
        if (error) throw error;
        refreshLeaderboardUI();
    } catch (err) {
        console.warn('[Leaderboard] submit-score 호출 실패:', err);
    }
}

// 1~3등은 순위 숫자("1.") 대신 트로피 이미지를 앞에 붙이고, 그 밖의 순위는 기존처럼
// 숫자로만 표시한다. innerHTML을 쓰면 닉네임에 포함된 문자가 마크업으로 해석될 수 있어서,
// 트로피 이미지는 별도 <img> 엘리먼트로, 닉네임/점수는 텍스트 노드로 각각 안전하게 붙인다.
const RANK_TROPHY_FILES = ['assets/setting/Trophy_01.png', 'assets/setting/Trophy_02.png', 'assets/setting/Trophy_03.png'];
function buildRankListItem(row, rank) {
    const li = document.createElement('li');
    const trophyFile = RANK_TROPHY_FILES[rank - 1];
    if (trophyFile) {
        // [신규] 1등이 가장 크고 2등, 3등 순으로 글자가 작아지되, 3등도 트로피 없는 4등
        // 이하(기본 글자 크기)보다는 크게 보이도록 행 전체에 순위별 크기 클래스를 붙인다.
        // 트로피 이미지 크기는 em 단위라 이 글자 크기를 그대로 따라 같이 커지고 작아진다.
        li.classList.add(`rank-row-${rank}`);
        const img = document.createElement('img');
        img.src = trophyFile;
        img.className = 'rank-trophy-icon';
        img.alt = t('rankAlt', { rank });
        li.appendChild(img);
        li.appendChild(document.createTextNode(`${row.nickname} - ${row.score_m}M`));
    } else {
        li.textContent = `${rank}. ${row.nickname} - ${row.score_m}M`;
    }
    return li;
}

// 홈 화면의 상위 기록 목록을 갱신한다.
async function refreshLeaderboardUI() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;

    if (!supabaseClient) {
        listEl.innerHTML = `<li class="leaderboard-empty">${t('rankingServerPreparing')}</li>`;
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('nickname, score_m')
            .order('score_m', { ascending: false })
            .limit(5);
        if (error) throw error;

        listEl.innerHTML = '';
        if (!data || data.length === 0) {
            listEl.innerHTML = `<li class="leaderboard-empty">${t('noRecordsYet')}</li>`;
            return;
        }
        data.forEach((row, i) => {
            listEl.appendChild(buildRankListItem(row, i + 1));
        });
    } catch (err) {
        console.warn('[Leaderboard] 목록 조회 실패:', err);
        listEl.innerHTML = `<li class="leaderboard-empty">${t('failedToLoad')}</li>`;
    }
}

// 랭킹 패널(전체 목록 + 내 순위 고정 행)을 갱신한다. 패널을 열 때만 호출한다
// (홈 화면에는 항상 상위 5개만 필요하므로, 전체 목록은 필요할 때만 불러온다).
async function refreshFullRankingUI() {
    const listEl = document.getElementById('rankingFullList');
    const myRankEl = document.getElementById('myRankRow');
    if (!listEl || !myRankEl) return;

    if (!supabaseClient) {
        listEl.innerHTML = `<li class="leaderboard-empty">${t('rankingServerPreparing')}</li>`;
        myRankEl.textContent = '';
        return;
    }

    try {
        // device_id도 같이 받아서, 그중 내 deviceId와 일치하는 행을 찾아 "내 순위"로 표시한다.
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('nickname, score_m, device_id')
            .order('score_m', { ascending: false })
            .limit(500);
        if (error) throw error;

        const myDeviceId = getOrCreateDeviceId();

        listEl.innerHTML = '';
        if (!data || data.length === 0) {
            listEl.innerHTML = `<li class="leaderboard-empty">${t('noRecordsYet')}</li>`;
        } else {
            data.forEach((row, i) => {
                const li = buildRankListItem(row, i + 1);
                // [신규] 전체 목록을 스크롤하다가도 내 기록을 바로 찾을 수 있도록, 1~3등
                // 트로피 강조와는 별개로 내 deviceId와 일치하는 행에도 노란색 강조를 추가한다.
                if (row.device_id === myDeviceId) li.classList.add('my-rank-row');
                listEl.appendChild(li);
            });
        }

        const myIndex = (data || []).findIndex(row => row.device_id === myDeviceId);
        if (myIndex >= 0) {
            const my = data[myIndex];
            myRankEl.textContent = t('myRankLine', { rank: myIndex + 1, nickname: my.nickname, score: my.score_m });
        } else {
            myRankEl.textContent = t('notRankedYet');
        }
    } catch (err) {
        console.warn('[Leaderboard] 전체 랭킹 조회 실패:', err);
        listEl.innerHTML = `<li class="leaderboard-empty">${t('failedToLoad')}</li>`;
        myRankEl.textContent = '';
    }
}

refreshLeaderboardUI();
