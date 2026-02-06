-- ============================================================
-- AI Trend Intelligence System - Database Schema
-- 부성티케이 B2B 업소용 주방설비 AI 동향 분석 시스템
-- ============================================================

-- 1. crawl_sources (크롤링 소스 관리)
CREATE TABLE crawl_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  source_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  crawl_interval_minutes INT DEFAULT 1440,
  last_crawl_at TIMESTAMPTZ,
  total_collected INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. raw_items (수집된 원본 데이터)
CREATE TABLE raw_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES crawl_sources(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT,
  content TEXT,
  url TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  raw_data JSONB,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, external_id)
);

-- 3. trends (AI 분석된 트렌드)
CREATE TABLE trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  relevance_score INT DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
  source_id UUID REFERENCES crawl_sources(id),
  source_name TEXT,
  source_icon TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  raw_item_ids UUID[] DEFAULT '{}',
  ai_analysis JSONB,
  published_date DATE,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. actions (액션 아이템)
CREATE TABLE actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id UUID REFERENCES trends(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  due_date DATE,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. crawl_logs (크롤링 실행 로그)
CREATE TABLE crawl_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES crawl_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  items_found INT DEFAULT 0,
  items_new INT DEFAULT 0,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. weekly_stats (주간 통계)
CREATE TABLE weekly_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  total_trends INT DEFAULT 0,
  total_actions INT DEFAULT 0,
  completed_actions INT DEFAULT 0,
  high_impact_count INT DEFAULT 0,
  top_categories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_start)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_raw_items_source ON raw_items(source_id);
CREATE INDEX idx_raw_items_processed ON raw_items(is_processed) WHERE NOT is_processed;
CREATE INDEX idx_trends_date ON trends(published_date DESC);
CREATE INDEX idx_trends_impact ON trends(impact);
CREATE INDEX idx_trends_category ON trends(category);
CREATE INDEX idx_trends_relevance ON trends(relevance_score DESC);
CREATE INDEX idx_actions_status ON actions(status);
CREATE INDEX idx_actions_trend ON actions(trend_id);
CREATE INDEX idx_crawl_logs_source ON crawl_logs(source_id, created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access" ON crawl_sources FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON crawl_sources FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated access" ON raw_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON raw_items FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated access" ON trends FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON trends FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated access" ON actions FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON actions FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated access" ON crawl_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON crawl_logs FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated access" ON weekly_stats FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role access" ON weekly_stats FOR ALL TO service_role USING (true);

-- ============================================================
-- Triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Initial crawl sources
-- ============================================================
INSERT INTO crawl_sources (name, icon, source_type, config, crawl_interval_minutes) VALUES
  ('Threads', '🧵', 'threads', '{"keywords": ["AI", "LLM", "GPT", "Claude", "automation", "B2B"]}', 1440),
  ('X (Twitter)', '𝕏', 'twitter', '{"keywords": ["AI", "LLM", "GPT", "Claude", "B2B SaaS"], "accounts": ["@AnthropicAI", "@OpenAI", "@GoogleAI"]}', 1440),
  ('Reddit', '🤖', 'reddit', '{"subreddits": ["artificial", "ChatGPT", "LocalLLaMA", "SaaS"]}', 1440),
  ('TechCrunch', '📰', 'rss', '{"feed_url": "https://techcrunch.com/category/artificial-intelligence/feed/"}', 1440),
  ('Product Hunt', '🚀', 'producthunt', '{"topics": ["artificial-intelligence", "saas", "developer-tools"]}', 1440),
  ('The Verge', '🔮', 'rss', '{"feed_url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"}', 1440),
  ('YouTube', '📺', 'youtube', '{"channels": ["UCbfYPyITQ-7l4upoX8nvctg"], "keywords": ["AI news"]}', 1440),
  ('Hacker News', '🟧', 'rss', '{"feed_url": "https://hnrss.org/newest?q=AI+LLM+GPT"}', 1440);

-- ============================================================
-- pg_cron: 매일 오전 8시 KST (UTC 23:00)
-- NOTE: [PROJECT_REF]와 [SERVICE_ROLE_KEY]를 실제 값으로 교체 필요
-- ============================================================
-- SELECT cron.schedule(
--   'crawl-ai-trends',
--   '0 23 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://[PROJECT_REF].supabase.co/functions/v1/crawl',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
--     )
--   );
--   $$
-- );
