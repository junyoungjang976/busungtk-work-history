// supabase/functions/analyze/index.ts
// AI 분석 엔진 - Claude API로 수집된 콘텐츠 분석 → 트렌드 + 액션 생성
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSINESS_CONTEXT = `당신은 부성티케이의 AI 트렌드 분석 전문가입니다.

부성티케이 비즈니스 컨텍스트:
- B2B 업소용 주방설비 전문 회사 (수원 소재)
- 핵심 사업: 업소용 주방 설계, 시공, 유지보수
- 주요 고객: 삼성, 에버랜드 등 대기업 급식/외식 시설
- 100% 인바운드 마케팅으로 고객 유치
- 평균 수주액 4천만원, 연매출 7.2억
- 기술스택: React + Supabase + Vercel, Solapi 카카오톡, Claude API
- 운영 시스템: 견적헬퍼, 주문추적, 유지보수 대시보드
- 전략: AEO(AI Engine Optimization) / GEO(Generative Engine Optimization) 진행중

분석 기준:
1. 부성티케이의 디지털 전환과 AI 활용에 직접적으로 관련된 트렌드를 높은 관련도로 평가
2. B2B 마케팅, 고객 관리, 업무 자동화 관련 트렌드 중시
3. 실제 적용 가능한 구체적인 액션 아이템 도출
4. 한국 시장 맥락을 고려한 분석`;

const ANALYSIS_PROMPT = `아래 수집된 AI/기술 관련 콘텐츠를 분석하여 부성티케이에 유용한 트렌드를 추출해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{
  "trends": [
    {
      "title": "한국어 간결한 제목 (30자 이내)",
      "summary": "부성티케이 관점에서 왜 중요한지 2-3문장 요약",
      "category": "LLM|SEO|B2B|챗봇|개발|생산성|마케팅|기타 중 하나",
      "impact": "high|medium|low",
      "relevance_score": 0-100,
      "tags": ["관련", "태그"],
      "source_items": [원본 번호 배열],
      "actions": [
        {
          "text": "부성티케이가 실행할 수 있는 구체적 액션",
          "priority": "high|medium|low"
        }
      ]
    }
  ]
}

중요:
- 유사한 콘텐츠는 하나의 트렌드로 병합
- 부성티케이와 무관한 콘텐츠는 제외하거나 낮은 관련도 부여
- 최소 1개, 최대 10개 트렌드 추출
- 각 트렌드당 최소 1개 액션 아이템 포함`;

// ── Claude API 호출 ───────────────────────────────────────
async function callClaude(
  apiKey: string,
  items: Array<{ idx: number; title: string; content: string; source: string; url: string }>
): Promise<{ trends: TrendResult[] }> {
  const itemsText = items
    .map((item) => `[${item.idx}] [${item.source}] ${item.title}\n${item.content}\n${item.url}`)
    .join("\n\n---\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system: BUSINESS_CONTEXT,
      messages: [
        {
          role: "user",
          content: `${ANALYSIS_PROMPT}\n\n--- 수집된 콘텐츠 (${items.length}개) ---\n\n${itemsText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // JSON 파싱 (코드 블록 안에 있을 수 있음)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude response is not valid JSON");

  return JSON.parse(jsonMatch[0]);
}

interface TrendResult {
  title: string;
  summary: string;
  category: string;
  impact: string;
  relevance_score: number;
  tags: string[];
  source_items: number[];
  actions: Array<{ text: string; priority: string }>;
}

// ── SMS 알림 (Solapi) ─────────────────────────────────────
async function sendSMSAlert(trend: TrendResult) {
  const apiKey = Deno.env.get("SOLAPI_API_KEY");
  const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
  const sender = Deno.env.get("SOLAPI_SENDER");
  const receiver = Deno.env.get("NOTIFY_PHONE");

  if (!apiKey || !apiSecret || !sender || !receiver) return;

  try {
    const message = `[AI트렌드 🔥HIGH]\n${trend.title}\n${trend.summary.slice(0, 80)}...`;

    // Solapi v4 API
    const timestamp = new Date().toISOString();
    const salt = crypto.randomUUID();

    // HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(timestamp + salt)
    );
    const sigHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${sigHex}`,
      },
      body: JSON.stringify({
        messages: [
          {
            to: receiver,
            from: sender,
            text: message,
            type: "SMS",
          },
        ],
      }),
    });

    console.log(`SMS alert sent for: ${trend.title}`);
  } catch (e) {
    console.error("SMS alert failed:", e);
  }
}

// ── 메인 핸들러 ───────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 미처리 원본 데이터 조회 (최대 50개)
    const { data: rawItems, error: rawError } = await supabase
      .from("raw_items")
      .select("*, crawl_sources(name, icon)")
      .eq("is_processed", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (rawError) throw rawError;
    if (!rawItems || rawItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unprocessed items", duration_ms: Date.now() - startTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing ${rawItems.length} items...`);

    // Claude에 보낼 형식으로 변환
    const itemsForClaude = rawItems.map((item: Record<string, unknown>, idx: number) => ({
      idx: idx + 1,
      title: (item.title as string) || "No title",
      content: ((item.content as string) || "").slice(0, 500),
      source: (item.crawl_sources as { name: string })?.name || "Unknown",
      url: (item.url as string) || "",
    }));

    // Claude API 호출
    const analysis = await callClaude(anthropicKey, itemsForClaude);
    const trends = analysis.trends || [];

    console.log(`Claude extracted ${trends.length} trends`);

    let trendsCreated = 0;
    let actionsCreated = 0;
    let highImpactCount = 0;

    for (const trend of trends) {
      // source_items 번호로 실제 raw_item ID 매핑
      const relatedItemIds = (trend.source_items || [])
        .filter((idx: number) => idx >= 1 && idx <= rawItems.length)
        .map((idx: number) => (rawItems[idx - 1] as Record<string, unknown>).id as string);

      // 첫 번째 관련 아이템의 소스 정보
      const firstItem = relatedItemIds.length > 0
        ? rawItems.find((r: Record<string, unknown>) => r.id === relatedItemIds[0])
        : rawItems[0];

      const sourceInfo = firstItem?.crawl_sources as { name: string; icon: string } | undefined;

      // trends 테이블에 삽입
      const { data: insertedTrend, error: trendError } = await supabase
        .from("trends")
        .insert({
          title: trend.title,
          summary: trend.summary,
          category: trend.category || "기타",
          impact: trend.impact || "medium",
          relevance_score: Math.min(100, Math.max(0, trend.relevance_score || 50)),
          source_name: sourceInfo?.name || null,
          source_icon: sourceInfo?.icon || null,
          source_url: (firstItem as Record<string, unknown>)?.url || null,
          source_id: (firstItem as Record<string, unknown>)?.source_id || null,
          tags: trend.tags || [],
          raw_item_ids: relatedItemIds,
          ai_analysis: trend,
          published_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (trendError) {
        console.error("Trend insert error:", trendError);
        continue;
      }

      trendsCreated++;

      // 액션 아이템 삽입
      if (trend.actions && trend.actions.length > 0) {
        const actionRows = trend.actions.map((action) => ({
          trend_id: insertedTrend.id,
          text: action.text,
          priority: action.priority || "medium",
          status: "pending",
        }));

        const { error: actionError } = await supabase.from("actions").insert(actionRows);
        if (actionError) {
          console.error("Action insert error:", actionError);
        } else {
          actionsCreated += actionRows.length;
        }
      }

      // HIGH 임팩트 알림
      if (trend.impact === "high") {
        highImpactCount++;
        await sendSMSAlert(trend);
      }
    }

    // raw_items를 처리 완료로 마킹
    const rawItemIds = rawItems.map((item: Record<string, unknown>) => item.id as string);
    await supabase
      .from("raw_items")
      .update({ is_processed: true })
      .in("id", rawItemIds);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        items_analyzed: rawItems.length,
        trends_created: trendsCreated,
        actions_created: actionsCreated,
        high_impact_count: highImpactCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Analyze function error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
