// start-run: 게임이 시작될 때 클라이언트가 호출하는 함수.
// 서버(DB) 시계 기준으로 "이 판이 언제 시작됐는지"를 run_tokens 테이블에 기록하고
// 토큰을 발급한다. submit-score 함수가 이 시각을 기준으로 제출된 점수가
// 물리적으로 가능한 값인지 검증하는 데 사용한다.
//
// 배포 방법은 SUPABASE_SETUP.md 참고 (대시보드에 붙여넣거나 CLI로 배포).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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
        const { data, error } = await supabaseAdmin
            .from("run_tokens")
            .insert({})
            .select("token, started_at")
            .single();

        if (error) throw error;

        return new Response(
            JSON.stringify({ token: data.token, startedAt: data.started_at }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
