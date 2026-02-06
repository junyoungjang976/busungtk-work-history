// supabase/functions/api/index.ts
// 프론트엔드용 REST API - 트렌드/액션/소스/통계 엔드포인트
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
    const segments = path.split("/").filter(Boolean);

    // ── GET /trends ─────────────────────────────────────
    if (req.method === "GET" && segments[0] === "trends") {
      const category = url.searchParams.get("category");
      const impact = url.searchParams.get("impact");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("trends")
        .select("*, actions(*)")
        .eq("is_archived", false)
        .order("published_date", { ascending: false })
        .order("relevance_score", { ascending: false })
        .limit(limit);

      if (category && category !== "전체") {
        query = query.eq("category", category);
      }
      if (impact) {
        query = query.eq("impact", impact);
      }

      const { data, error } = await query;
      if (error) throw error;

      return jsonResponse(data);
    }

    // ── GET /actions ────────────────────────────────────
    if (req.method === "GET" && segments[0] === "actions") {
      const status = url.searchParams.get("status");

      let query = supabase
        .from("actions")
        .select("*, trends(id, title, category, impact)")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return jsonResponse(data);
    }

    // ── PATCH /actions/:id ──────────────────────────────
    if (req.method === "PATCH" && segments[0] === "actions" && segments[1]) {
      const actionId = segments[1];
      const body = await req.json();

      const updates: Record<string, unknown> = {};
      if (body.status) {
        updates.status = body.status;
        if (body.status === "done") {
          updates.completed_at = new Date().toISOString();
        } else {
          updates.completed_at = null;
        }
      }
      if (body.notes !== undefined) {
        updates.notes = body.notes;
      }

      const { data, error } = await supabase
        .from("actions")
        .update(updates)
        .eq("id", actionId)
        .select("*, trends(id, title)")
        .single();

      if (error) throw error;

      return jsonResponse(data);
    }

    // ── GET /sources ────────────────────────────────────
    if (req.method === "GET" && segments[0] === "sources") {
      const { data: sources, error } = await supabase
        .from("crawl_sources")
        .select("*")
        .order("name");

      if (error) throw error;

      // 각 소스의 최근 로그 가져오기
      const sourcesWithLogs = await Promise.all(
        (sources || []).map(async (source: Record<string, unknown>) => {
          const { data: logs } = await supabase
            .from("crawl_logs")
            .select("*")
            .eq("source_id", source.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return { ...source, recent_log: logs?.[0] || null };
        })
      );

      return jsonResponse(sourcesWithLogs);
    }

    // ── GET /stats ──────────────────────────────────────
    if (req.method === "GET" && segments[0] === "stats") {
      // 이번 주 시작일 (월요일)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekStart = monday.toISOString().split("T")[0];

      // 이번 주 트렌드 수
      const { count: trendsCount } = await supabase
        .from("trends")
        .select("*", { count: "exact", head: true })
        .gte("published_date", weekStart);

      // 전체 액션 수
      const { count: actionsCount } = await supabase
        .from("actions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekStart + "T00:00:00");

      // 완료 액션 수
      const { count: completedCount } = await supabase
        .from("actions")
        .select("*", { count: "exact", head: true })
        .eq("status", "done")
        .gte("created_at", weekStart + "T00:00:00");

      // HIGH 임팩트 수
      const { count: highCount } = await supabase
        .from("trends")
        .select("*", { count: "exact", head: true })
        .eq("impact", "high")
        .gte("published_date", weekStart);

      const total = actionsCount || 0;
      const completed = completedCount || 0;
      const applyRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return jsonResponse({
        week_start: weekStart,
        total_trends: trendsCount || 0,
        total_actions: total,
        completed_actions: completed,
        high_impact_count: highCount || 0,
        apply_rate: applyRate,
      });
    }

    // ── POST /crawl/trigger ─────────────────────────────
    if (req.method === "POST" && segments[0] === "crawl" && segments[1] === "trigger") {
      const crawlUrl = `${supabaseUrl}/functions/v1/crawl`;
      const response = await fetch(crawlUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ triggered_by: "manual" }),
      });

      const result = await response.json();
      return jsonResponse(result);
    }

    // ── 404 ─────────────────────────────────────────────
    return jsonResponse({ error: "Not found", path }, 404);
  } catch (e) {
    console.error("API error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});
