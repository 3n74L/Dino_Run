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

// 마우스 클릭 이벤트 처리 (버튼 클릭 타겟 필터링 포함)
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.tagName !== 'BUTTON') {
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
    if (e.target.tagName !== 'BUTTON') {
        handleJump();
    }
}, { passive: true });

window.addEventListener('touchend', () => {
    handleInputRelease();
});