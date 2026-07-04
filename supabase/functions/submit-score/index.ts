// submit-score: 게임오버 시 클라이언트가 호출하는 함수.
// start-run에서 발급된 토큰과 최종 점수를 받아서,
//   1) 토큰이 유효하고 아직 사용되지 않았는지
//   2) 서버가 기록해둔 시작 시각으로부터 지금까지 경과한 실제 시간 안에서
//      이 점수가 물리적으로 가능한 값인지(너무 큰 값이 아닌지)
// 를 검증한 뒤에만 leaderboard 테이블에 기록한다.
// 한 사람(device_id, 브라우저 localStorage에 저장된 임의 UUID)당 최고 기록 하나만
// 유지한다 - 기존 기록보다 낮은 점수는 무시하고, 높은 점수만 upsert로 덮어쓴다.
//
// MAX_METERS_PER_SEC 계산 근거 (js/main.js, js/background.js와 맞춰 관리):
//   - window.gameConfig.maxSpeed = 12 (px/프레임)
//   - METERS_PER_PIXEL = 0.1 (10px 이동 = 1M)
//   - 프레임레이트를 아주 넉넉하게 300fps까지 가정(대부분의 모니터를 여유 있게 커버)
//   - 12 px/프레임 * 300프레임/초 * 0.1 M/px = 360 M/초
// 실제 플레이는 초반에 baseSpeed가 2에서 서서히 올라가므로 이 값보다 항상 느리다.
// 즉 이 상한선은 "정상 플레이는 절대 넘지 못하지만, 조작된 값은 쉽게 넘는" 여유 있는 값이다.
// 물리 값을 바꿀 일이 있으면 이 상수도 같이 재계산해야 한다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MAX_METERS_PER_SEC = 360;
const MAX_NICKNAME_LEN = 8;

// [신규] 닉네임 욕설/비속어 최소 방어. 완벽한 탐지는 불가능하지만(초성/자모분리/특수문자
// 우회 등), 대표적인 한국어 비속어와 영어 욕설을 걸러서 노골적인 경우는 막는다.
// 걸리면 점수 제출 자체는 막지 않고(플레이 기록은 남기되) 닉네임만 "익명"으로 대체한다.
const BANNED_NICKNAME_PATTERN =
    /씨발|시발|씨팔|시팔|병신|ㅂㅅ|좆|존나|지랄|개새끼|새끼|미친놈|미친년|섹스|자지|보지|걸레|창녀|fuck|shit|bitch|asshole|cunt|dick|pussy|nigger|whore/i;

function sanitizeNickname(raw: string): string {
    const trimmed = raw.trim().slice(0, MAX_NICKNAME_LEN);
    if (!trimmed || BANNED_NICKNAME_PATTERN.test(trimmed)) return "익명";
    return trimmed;
}

// [중요] 브라우저에서 직접 호출하는 함수라 CORS 헤더가 없으면 프리플라이트(OPTIONS)
// 단계에서 막혀버린다. 정적 사이트를 어느 도메인에 올릴지 몰라도 되도록 전부 허용.
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { token, nickname, score, deviceId } = await req.json();

        if (!token || typeof score !== "number" || !Number.isFinite(score) || typeof deviceId !== "string") {
            return jsonError("잘못된 요청");
        }

        const { data: run, error: findError } = await supabaseAdmin
            .from("run_tokens")
            .select("*")
            .eq("token", token)
            .single();

        if (findError || !run) return jsonError("유효하지 않은 토큰");
        if (run.used) return jsonError("이미 제출된 기록입니다");

        const elapsedSec = (Date.now() - new Date(run.started_at).getTime()) / 1000;
        const maxScore = elapsedSec * MAX_METERS_PER_SEC;

        if (score < 0 || score > maxScore) {
            return jsonError("비정상적인 점수입니다");
        }

        const cleanNickname = sanitizeNickname(typeof nickname === "string" ? nickname : "");

        // [수정] 한 사람(device_id)당 최고 기록만 유지. 기존 기록보다 낮으면 아예 쓰지 않는다
        // (leaderboard.device_id에 unique 인덱스가 있어 upsert로 갱신).
        const { data: existing } = await supabaseAdmin
            .from("leaderboard")
            .select("score_m")
            .eq("device_id", deviceId)
            .maybeSingle();

        if (!existing || score > existing.score_m) {
            const { error: upsertError } = await supabaseAdmin
                .from("leaderboard")
                .upsert(
                    { device_id: deviceId, nickname: cleanNickname, score_m: Math.floor(score) },
                    { onConflict: "device_id" }
                );
            if (upsertError) throw upsertError;
        }

        await supabaseAdmin.from("run_tokens").update({ used: true }).eq("token", token);

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        return jsonError(String(err));
    }
});

function jsonError(message: string) {
    return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
