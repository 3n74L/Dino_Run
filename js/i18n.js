// 다국어(i18n) 지원. 별도의 "언어 선택" 버튼 없이, 기기의 기본 언어(navigator.language)를
// 그대로 읽어서 지원하는 언어 중 하나로 자동 매칭한다. 지원하지 않는 언어면 영어로 대체한다.
// 반드시 다른 스크립트(leaderboard.js 등)보다 먼저 로드되어야 t()/applyTranslations()를
// 쓸 수 있다 (index.html의 스크립트 순서 맨 앞).

const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh', 'vi'];

const translations = {
    ko: {
        settingsAlt: '설정',
        rankingAlt: '랭킹',
        settingsTitle: '설정',
        labelMusic: '배경음악',
        labelSfx: '효과음',
        labelVolume: '음량',
        labelHitbox: '히트박스 표시',
        hitboxNote: '⚠ 히트박스를 켜면 랭킹에 등록되지 않습니다.',
        labelInvert: '반전 모드',
        closeBtn: '닫기',
        gameTitle: '다이노 런',
        nicknamePlaceholder: '닉네임',
        playBtn: '플레이 ▶',
        rankingTitle: '랭킹',
        disclaimer: '본 게임은 비상업적 팬메이드 프로젝트이며, 사용된 일부 그래픽 리소스는 모바일 게임에서 발췌되었고 저작권은 각 원저작자에게 있습니다. 수익을 창출하지 않으며, 저작권자의 요청 시 즉시 삭제합니다.',
        loadingAlt: '로딩중',
        homeAlt: '홈',
        restartAlt: '재시작',
        rankingServerPreparing: '랭킹 서버 준비 중',
        noRecordsYet: '아직 기록이 없습니다',
        failedToLoad: '랭킹을 불러오지 못했습니다',
        myRankLine: '내 순위: {rank}위 - {nickname} - {score}M',
        notRankedYet: '아직 등록된 기록이 없습니다',
        rankAlt: '{rank}등'
    },
    en: {
        settingsAlt: 'Settings',
        rankingAlt: 'Ranking',
        settingsTitle: 'Settings',
        labelMusic: 'Music',
        labelSfx: 'Sound Effects',
        labelVolume: 'Volume',
        labelHitbox: 'Show Hitbox',
        hitboxNote: '⚠ Turning on hitbox display will exclude your score from the leaderboard.',
        labelInvert: 'Invert Mode',
        closeBtn: 'Close',
        gameTitle: 'Dino Run',
        nicknamePlaceholder: 'Nickname',
        playBtn: 'Play ▶',
        rankingTitle: 'Ranking',
        disclaimer: 'This game is a non-commercial fan-made project. Some graphic resources used are taken from mobile games, and their copyrights belong to their respective original owners. No profit is made from this project, and content will be removed immediately upon request from the copyright holder.',
        loadingAlt: 'Loading',
        homeAlt: 'Home',
        restartAlt: 'Restart',
        rankingServerPreparing: 'Leaderboard server is being set up',
        noRecordsYet: 'No records yet',
        failedToLoad: 'Failed to load the leaderboard',
        myRankLine: 'My Rank: #{rank} - {nickname} - {score}M',
        notRankedYet: "You haven't set a record yet",
        rankAlt: 'Rank {rank}'
    },
    ja: {
        settingsAlt: '設定',
        rankingAlt: 'ランキング',
        settingsTitle: '設定',
        labelMusic: 'BGM',
        labelSfx: '効果音',
        labelVolume: '音量',
        labelHitbox: '当たり判定表示',
        hitboxNote: '⚠ 当たり判定を表示するとランキングには登録されません。',
        labelInvert: '反転モード',
        closeBtn: '閉じる',
        gameTitle: 'Dino Run',
        nicknamePlaceholder: 'ニックネーム',
        playBtn: 'プレイ ▶',
        rankingTitle: 'ランキング',
        disclaimer: '本ゲームは非商業的なファンメイドプロジェクトであり、使用されている一部のグラフィック素材はモバイルゲームから抜粋したもので、著作権は各原著作者に帰属します。収益は一切発生しておらず、著作権者からの要請があれば直ちに削除いたします。',
        loadingAlt: '読み込み中',
        homeAlt: 'ホーム',
        restartAlt: 'リスタート',
        rankingServerPreparing: 'ランキングサーバー準備中',
        noRecordsYet: 'まだ記録がありません',
        failedToLoad: 'ランキングを読み込めませんでした',
        myRankLine: '自分の順位：{rank}位 - {nickname} - {score}M',
        notRankedYet: 'まだ登録された記録がありません',
        rankAlt: '{rank}位'
    },
    zh: {
        settingsAlt: '设置',
        rankingAlt: '排行榜',
        settingsTitle: '设置',
        labelMusic: '背景音乐',
        labelSfx: '音效',
        labelVolume: '音量',
        labelHitbox: '显示碰撞箱',
        hitboxNote: '⚠ 开启碰撞箱显示后，成绩将不会计入排行榜。',
        labelInvert: '反色模式',
        closeBtn: '关闭',
        gameTitle: 'Dino Run',
        nicknamePlaceholder: '昵称',
        playBtn: '开始 ▶',
        rankingTitle: '排行榜',
        disclaimer: '本游戏为非商业性同人（爱好者制作）项目，部分使用的图形素材摘自手机游戏，版权归各原作者所有。本项目不产生任何收益，如版权方提出要求，将立即删除相关内容。',
        loadingAlt: '加载中',
        homeAlt: '主页',
        restartAlt: '重新开始',
        rankingServerPreparing: '排行榜服务器准备中',
        noRecordsYet: '暂无记录',
        failedToLoad: '排行榜加载失败',
        myRankLine: '我的排名：第{rank}名 - {nickname} - {score}M',
        notRankedYet: '您还没有已登记的记录',
        rankAlt: '第{rank}名'
    },
    vi: {
        settingsAlt: 'Cài đặt',
        rankingAlt: 'Bảng xếp hạng',
        settingsTitle: 'Cài đặt',
        labelMusic: 'Nhạc nền',
        labelSfx: 'Hiệu ứng âm thanh',
        labelVolume: 'Âm lượng',
        labelHitbox: 'Hiển thị Hitbox',
        hitboxNote: '⚠ Bật hiển thị hitbox sẽ khiến điểm của bạn không được ghi vào bảng xếp hạng.',
        labelInvert: 'Chế độ đảo màu',
        closeBtn: 'Đóng',
        gameTitle: 'Dino Run',
        nicknamePlaceholder: 'Biệt danh',
        playBtn: 'Chơi ▶',
        rankingTitle: 'Bảng xếp hạng',
        disclaimer: 'Trò chơi này là một dự án phi thương mại do người hâm mộ thực hiện. Một số tài nguyên đồ họa được sử dụng được trích từ các trò chơi di động và bản quyền thuộc về chủ sở hữu gốc tương ứng. Dự án không tạo ra bất kỳ lợi nhuận nào và sẽ được gỡ bỏ ngay lập tức nếu có yêu cầu từ chủ sở hữu bản quyền.',
        loadingAlt: 'Đang tải',
        homeAlt: 'Trang chủ',
        restartAlt: 'Chơi lại',
        rankingServerPreparing: 'Máy chủ bảng xếp hạng đang được chuẩn bị',
        noRecordsYet: 'Chưa có kỷ lục nào',
        failedToLoad: 'Không tải được bảng xếp hạng',
        myRankLine: 'Thứ hạng của tôi: #{rank} - {nickname} - {score}M',
        notRankedYet: 'Bạn chưa có kỷ lục nào được ghi nhận',
        rankAlt: 'Hạng {rank}'
    }
};

// navigator.languages(우선순위 순 배열)를 훑어서 지원 언어와 일치하는 첫 번째 항목을 쓴다.
// "zh-TW"/"zh-HK"(번체)도 현재는 간체 번역만 있으므로 그냥 zh로 매칭한다.
function detectLocale() {
    const candidates = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || 'en'];
    for (const tag of candidates) {
        const primary = tag.split('-')[0].toLowerCase();
        if (SUPPORTED_LOCALES.includes(primary)) return primary;
    }
    return 'en';
}

const currentLocale = detectLocale();
document.documentElement.lang = currentLocale;

// vars: { rank: 3, nickname: '홍길동', score: 1234 } 같은 치환값. {rank} 형태의 자리표시자를 채운다.
function t(key, vars) {
    let str = (translations[currentLocale] && translations[currentLocale][key])
        || translations.en[key]
        || key;
    if (vars) {
        for (const varName in vars) {
            str = str.replace(new RegExp(`\\{${varName}\\}`, 'g'), vars[varName]);
        }
    }
    return str;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
        el.alt = t(el.getAttribute('data-i18n-alt'));
    });
}

applyTranslations();
