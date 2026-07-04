# 랭킹 시스템 설치 가이드 (Supabase)

이 문서는 계정 생성/키 발급/함수 배포처럼 **AI가 대신 할 수 없는, 사용자가 직접 해야 하는 작업**만
정리한 것입니다. 코드 쪽(클라이언트 연동, SQL 스키마, Edge Function 소스)은 이미 전부 만들어져
있고, Supabase 프로젝트가 없어도 게임 자체는 평소처럼 정상 동작합니다. 아래 단계를 마치기 전까지는
홈 화면에 "랭킹 서버 준비 중"이라고만 표시됩니다.

## 왜 이런 구조인가 (요약)
클라이언트(브라우저)는 랭킹을 **읽기만** 할 수 있고, **쓰기는 서버 쪽 함수 두 개(start-run,
submit-score)만** 할 수 있습니다. 그래서 개발자도구로 점수 변수를 조작해도 실제 랭킹 DB에는
반영되지 않습니다. 자세한 설계는 대화 중 설명한 내용을 참고하세요.

## 1. Supabase 프로젝트 생성 (무료, 카드 등록 불필요)
1. https://supabase.com 접속 → 회원가입(GitHub 계정으로 가능) → **New Project** 생성.
2. 프로젝트 이름, DB 비밀번호(아무 값이나, 나중에 안 씀), 리전은 아무거나 선택.
3. 프로젝트가 만들어질 때까지 1~2분 대기.

## 2. DB 스키마 적용
1. 왼쪽 메뉴에서 **SQL Editor** 클릭.
2. `supabase/schema.sql` 파일 내용을 전부 복사해서 붙여넣고 **Run** 클릭.
3. 왼쪽 메뉴 **Table Editor**에서 `run_tokens`, `leaderboard` 테이블 두 개가 생겼는지 확인.

## 3. API 키 복사 → 클라이언트 설정에 붙여넣기
1. 왼쪽 메뉴 **Settings → API**로 이동.
2. **Project URL**과 **anon public** key를 복사.
3. 이 프로젝트의 `js/supabase-config.js` 파일을 열어서:
   ```js
   window.SUPABASE_CONFIG = {
       url: '여기에 Project URL 붙여넣기',
       anonKey: '여기에 anon public key 붙여넣기'
   };
   ```
   이렇게 채워넣으세요. (저에게 값을 알려주시면 제가 대신 채워드릴 수도 있습니다.)

## 4. Edge Function 배포 (start-run, submit-score)
CLI 설치 없이 **대시보드에서 바로 붙여넣는 방법**을 추천합니다 (이 프로젝트는 지금까지 빌드
도구를 전혀 안 썼으니, 새로 뭘 설치할 필요 없는 이 방법이 제일 간단합니다):

1. 왼쪽 메뉴 **Edge Functions** → **Create a new function**.
2. 이름을 정확히 `start-run`으로 입력 → 에디터가 열리면 이 저장소의
   `supabase/functions/start-run/index.ts` 내용을 전부 복사해서 붙여넣고 **Deploy**.
3. 같은 방식으로 함수 하나 더 생성, 이름은 정확히 `submit-score` → 
   `supabase/functions/submit-score/index.ts` 내용을 붙여넣고 **Deploy**.
4. 두 함수 모두 **Settings**에서 "Enforce JWT Verification"(또는 유사 옵션)이 켜져 있어도
   괜찮습니다 — 클라이언트가 anon key로 호출하면 통과합니다.

> CLI를 쓰고 싶다면: `npm install -g supabase` → `supabase login` → 이 폴더에서
> `supabase link --project-ref <프로젝트-ref>` → `supabase functions deploy start-run` →
> `supabase functions deploy submit-score`. 두 방법 중 편한 쪽으로 하시면 됩니다.

## 5. 확인
1. `index.html`을 새로고침해서 브라우저 콘솔(F12)에 빨간 에러가 없는지 확인.
2. 홈 화면 TOP 5 목록이 "랭킹 서버 준비 중" 대신 "아직 기록이 없습니다"로 바뀌면 연결 성공.
3. 게임을 한 판 플레이해서 게임오버까지 간 뒤 홈으로 돌아와서 내 기록이 목록에 뜨는지 확인.
4. 안 되면 콘솔에 `[Leaderboard]`로 시작하는 경고 메시지가 뜰 텐데, 그 내용을 그대로 알려주시면
   같이 원인을 찾겠습니다. 정 안 되면 이 기능 전체를 롤백하고 다른 방법(Firebase 등)을
   시도해볼 수 있습니다.

## 업데이트: "한 사람당 최고 기록만" + 랭킹 패널 UI (이미 설치를 마친 경우)
이미 위 1~5단계를 마치고 랭킹이 동작하는 상태라면, 아래 두 가지만 추가로 적용하면 됩니다.

1. **SQL Editor**에서 아래 마이그레이션 SQL을 실행 (기존 `leaderboard` 테이블에 `device_id`
   컬럼 + unique 인덱스 추가):
   ```sql
   alter table leaderboard add column if not exists device_id uuid;
   create unique index if not exists leaderboard_device_id_key on leaderboard (device_id);
   ```
   테스트 삼아 넣었던 기존 기록들은 `device_id`가 비어있는 채로 남아있어도 문제없습니다
   (unique 인덱스는 NULL끼리는 중복으로 안 봄). 지저분하면 **Table Editor**에서 직접 지워도 됩니다.
2. **Edge Functions → submit-score**로 가서, 업데이트된 `supabase/functions/submit-score/index.ts`
   내용으로 전체 교체 후 다시 **Deploy** (이번 대화에서 코드가 바뀐 부분: device_id를 받아서
   기존 기록보다 높을 때만 upsert하도록 수정됨).

`start-run` 함수는 이번에 안 바뀌었으니 다시 배포하지 않아도 됩니다. 클라이언트 쪽
(`js/leaderboard.js`, `index.html`, `style.css`, `main.js`)은 이미 다 반영되어 있어서 새로고침만
하면 됩니다.

## 업데이트: 닉네임 욕설/비속어 필터 (이미 설치를 마친 경우)
SQL/함수 배포는 필요 없고, **Edge Functions → submit-score**만 최신
`supabase/functions/submit-score/index.ts` 내용으로 다시 교체해서 **Deploy**하면 됩니다
(닉네임에 대표적인 비속어/욕설이 포함되면 자동으로 "익명"으로 바뀌어 저장되도록 추가됨).

## 나중에 인터넷에 공개 배포할 때
지금은 로컬 파일(file://)로 열어서 테스트하고 있는데, 실제로 아무나 접속하게 하려면 이 폴더를
정적 호스팅(예: GitHub Pages, Netlify, Cloudflare Pages 등)에 올려야 합니다. 이건 랭킹 시스템과는
별개의 작업이라, 랭킹이 잘 동작하는 걸 확인한 뒤에 별도로 도와드리겠습니다.
