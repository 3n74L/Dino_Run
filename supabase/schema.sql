-- 다이노 런 랭킹 시스템 - DB 스키마 + 보안 규칙(RLS)
-- Supabase 대시보드 > SQL Editor에 이 파일 내용을 그대로 붙여넣고 실행하세요.
--
-- 설계 원칙: 클라이언트(브라우저)는 leaderboard 테이블을 "읽기"만 할 수 있고,
-- "쓰기"는 오직 Edge Function(submit-score)만 할 수 있습니다. 클라이언트가 가진
-- anon key로는 절대 점수를 직접 써넣을 수 없습니다(RLS로 insert/update/delete 정책을
-- 아예 만들지 않았기 때문 - 정책이 없으면 RLS가 기본적으로 전부 거부합니다).

create extension if not exists "pgcrypto";

-- 1. 게임 시작 시각을 서버 기준으로 기록해두는 테이블.
--    submit-score 함수가 "제출된 점수가 이 시각 이후 경과 시간 안에서 물리적으로
--    가능한 값인지" 검증하는 데 사용합니다. 클라이언트/anon key는 이 테이블에
--    전혀 접근할 수 없습니다(RLS는 켜져 있지만 정책이 하나도 없음).
create table if not exists run_tokens (
    token uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    used boolean not null default false
);
alter table run_tokens enable row level security;

-- 2. 실제로 공개되는 랭킹 테이블. 누구나 읽을 수 있지만, 쓰기는 Edge Function
--    (service_role 키 사용, RLS를 우회함)만 가능합니다.
--    device_id: 브라우저(localStorage)에 저장되는 임의의 UUID로 "한 사람"을 구분하는 용도.
--    로그인 시스템이 없어서 완벽한 식별은 아니지만, 닉네임 중복 문제 없이 "한 사람당 최고
--    기록 하나만" 유지하기 위한 실용적인 키. unique 인덱스로 사람당 한 행만 남도록 강제.
create table if not exists leaderboard (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null,
    nickname text not null,
    score_m integer not null,
    created_at timestamptz not null default now()
);
alter table leaderboard enable row level security;

drop policy if exists "누구나 랭킹 읽기 가능" on leaderboard;
create policy "누구나 랭킹 읽기 가능" on leaderboard
    for select using (true);

-- insert/update/delete 정책은 의도적으로 만들지 않습니다.
-- => anon key로는 어떤 방식으로도 leaderboard에 쓸 수 없습니다.

-- device_id 하나당 행 하나만 존재하도록 강제 (submit-score가 이 제약을 이용해 upsert함)
create unique index if not exists leaderboard_device_id_key on leaderboard (device_id);

-- (선택) 조회 성능을 위한 인덱스
create index if not exists leaderboard_score_desc_idx on leaderboard (score_m desc);
