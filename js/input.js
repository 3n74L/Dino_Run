// [신규] 이미지든 글자든 마우스로 드래그되지 않도록 전역 차단 (게임 UI 특성상 불필요)
window.addEventListener('dragstart', (e) => e.preventDefault());

// 키보드 이벤트 처리 (점프 및 일시정지 토글)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault(); // 스페이스바 스크롤 방지
        handleJump();
    }
    if (e.code === 'Escape') {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleInputRelease();
    }
});

// 마우스 클릭 이벤트 처리 (버튼/입력칸 클릭 타겟 필터링 포함)
// [수정] BUTTON만 걸러내서, 홈 화면의 닉네임 입력칸(INPUT)을 클릭해도 handleJump()가
// 호출되던 문제 수정. 지금은 게임 화면이 안 보일 때라 눈에 띄는 오류로 이어지진 않지만,
// 입력칸 클릭이 점프 입력으로 취급되는 건 의도한 동작이 아니라서 INPUT도 같이 제외.
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        handleJump();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        handleInputRelease();
    }
});

// 모바일 터치 이벤트 처리
window.addEventListener('touchstart', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        handleJump();
    }
}, { passive: true });

window.addEventListener('touchend', () => {
    handleInputRelease();
});