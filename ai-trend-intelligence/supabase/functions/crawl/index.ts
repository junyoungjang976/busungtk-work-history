// supabase/functions/crawl/index.ts
// 크롤링 오케스트레이터 - 8개 소스에서 AI 관련 콘텐츠 수집
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CrawlSource {
  id: string;
  name: string;
  icon: string;
  source_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

interface RawItem {
  source_id: string;
  external_id: string;
  title: string;
  content: string;
  url: string;
  author: string;
  published_at: string | null;
  raw_data: Record<string, unknown>;
}

// ── RSS 파서 ──────────────────────────────────────────────
function parseXML(xml: string): RawItem[] {
  const items: RawItem[] = [];
  // <item> 블록 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const creator = extractTag(block, "dc:creator") || extractTag(block, "author");
    const guid = extractTag(block, "guid") || link;

    if (title || link) {
      items.push({
        source_id: "", // filled later
        external_id: guid || `${link}-${title}`,
        title: cleanHTML(title || ""),
        content: cleanHTML(description || ""),
        url: link || "",
        author: creator || "",
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
        raw_data: { title, link, description, pubDate },
      });
    }
  }

  // <entry> (Atom) 블록 추출
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/) ||
                      block.match(/<link[^>]*>([^<]*)<\/link>/);
    const link = linkMatch ? linkMatch[1] : "";
    const summary = extractTag(block, "summary") || extractTag(block, "content");
    const updated = extractTag(block, "updated") || extractTag(block, "published");
    const authorName = extractTag(block, "name");
    const id = extractTag(block, "id") || link;

    if (title || link) {
      items.push({
        source_id: "",
        external_id: id || `${link}-${title}`,
        title: cleanHTML(title || ""),
        content: cleanHTML(summary || ""),
        url: link || "",
        author: authorName || "",
        published_at: updated ? new Date(updated).toISOString() : null,
        raw_data: { title, link, summary, updated },
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function cleanHTML(str: string): string {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ── RSS 크롤러 ────────────────────────────────────────────
async function crawlRSS(source: CrawlSource): Promise<RawItem[]> {
  const feedUrl = (source.config as { feed_url?: string }).feed_url;
  if (!feedUrl) return [];

  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "AI-Trend-Intelligence/1.0" },
  });
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

  const xml = await response.text();
  const items = parseXML(xml);
  return items.slice(0, 20).map((item) => ({ ...item, source_id: source.id }));
}

// ── Reddit 크롤러 ─────────────────────────────────────────
async function crawlReddit(source: CrawlSource): Promise<RawItem[]> {
  const config = source.config as { subreddits?: string[] };
  const subreddits = config.subreddits || [];
  const items: RawItem[] = [];

  for (const sub of subreddits) {
    try {
      const response = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        { headers: { "User-Agent": "AI-Trend-Intelligence/1.0" } }
      );
      if (!response.ok) continue;

      const data = await response.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const d = post.data;
        if ((d.score || 0) < 50) continue;

        items.push({
          source_id: source.id,
          external_id: d.id || d.name,
          title: d.title || "",
          content: d.selftext || d.title || "",
          url: d.url || `https://reddit.com${d.permalink}`,
          author: d.author || "",
          published_at: d.created_utc
            ? new Date(d.created_utc * 1000).toISOString()
            : null,
          raw_data: {
            subreddit: sub,
            score: d.score,
            num_comments: d.num_comments,
            permalink: d.permalink,
          },
        });
      }
    } catch (e) {
      console.error(`Reddit r/${sub} error:`, e);
    }
  }

  return items;
}

// ── 메인 핸들러 ───────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 활성 소스 조회
    const { data: sources, error: srcError } = await supabase
      .from("crawl_sources")
      .select("*")
      .eq("is_active", true);

    if (srcError) throw srcError;
    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active sources" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      source: string;
      found: number;
      new_items: number;
      status: string;
      error?: string;
    }> = [];
    let totalNewItems = 0;

    for (const source of sources) {
      const sourceStart = Date.now();
      let items: RawItem[] = [];
      let logStatus = "success";
      let errorMsg: string | null = null;

      try {
        switch (source.source_type) {
          case "rss":
            items = await crawlRSS(source);
            break;
          case "reddit":
            items = await crawlReddit(source);
            break;
          case "threads":
          case "twitter":
          case "youtube":
          case "producthunt":
            logStatus = "skipped";
            errorMsg = `${source.source_type} crawler not yet implemented`;
            console.log(`Skipping ${source.name}: ${errorMsg}`);
            break;
          default:
            logStatus = "skipped";
            errorMsg = `Unknown source type: ${source.source_type}`;
        }
      } catch (e) {
        logStatus = "error";
        errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`Crawl error for ${source.name}:`, errorMsg);
      }

      // raw_items에 upsert
      let newCount = 0;
      if (items.length > 0) {
        const { data: upserted, error: upsertError } = await supabase
          .from("raw_items")
          .upsert(items, {
            onConflict: "source_id,external_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (upsertError) {
          console.error(`Upsert error for ${source.name}:`, upsertError);
          logStatus = "error";
          errorMsg = upsertError.message;
        } else {
          newCount = upserted?.length || 0;
          totalNewItems += newCount;
        }
      }

      const duration = Date.now() - sourceStart;

      // crawl_logs 기록
      await supabase.from("crawl_logs").insert({
        source_id: source.id,
        status: logStatus,
        items_found: items.length,
        items_new: newCount,
        error_message: errorMsg,
        duration_ms: duration,
      });

      // crawl_sources 업데이트
      if (logStatus === "success") {
        await supabase
          .from("crawl_sources")
          .update({
            last_crawl_at: new Date().toISOString(),
            total_collected: (source.total_collected || 0) + newCount,
          })
          .eq("id", source.id);
      }

      results.push({
        source: source.name,
        found: items.length,
        new_items: newCount,
        status: logStatus,
        ...(errorMsg ? { error: errorMsg } : {}),
      });
    }

    // 새 아이템이 있으면 analyze 함수 트리거
    if (totalNewItems > 0) {
      try {
        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze`;
        await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "crawl", new_items: totalNewItems }),
        });
        console.log(`Triggered analyze for ${totalNewItems} new items`);
      } catch (e) {
        console.error("Failed to trigger analyze:", e);
      }
    }

    const totalDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        total_new_items: totalNewItems,
        duration_ms: totalDuration,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Crawl function error:", e);
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
