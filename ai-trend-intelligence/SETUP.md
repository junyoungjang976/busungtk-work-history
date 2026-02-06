# AI Trend Intelligence - 설정 가이드

부성티케이 AI 동향 자동 수집 + 분석 + 대시보드 시스템

## 전체 아키텍처

```
매일 08:00 KST (pg_cron)
  → crawl Edge Function (8개 소스 수집)
  → analyze Edge Function (Claude Sonnet 분석)
  → trends + actions 자동 생성
  → HIGH 임팩트 SMS 알림
  → 모바일 대시보드 확인
```

## 1. Supabase 설정

### DB 스키마 생성
1. Supabase Dashboard → SQL Editor 열기
2. `supabase/migrations/001_schema.sql` 내용 전체 복사하여 실행
3. 6개 테이블 + 인덱스 + RLS + 초기 데이터 자동 생성

### Edge Functions 배포
```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인 및 프로젝트 연결
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Functions 배포
supabase functions deploy crawl
supabase functions deploy analyze
supabase functions deploy api
```

### 환경변수 (Secrets)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx

# 선택: SMS 알림
supabase secrets set SOLAPI_API_KEY=your-key
supabase secrets set SOLAPI_API_SECRET=your-secret
supabase secrets set SOLAPI_SENDER=your-number
supabase secrets set NOTIFY_PHONE=target-number
```

### pg_cron 설정
SQL Editor에서 실행 (PROJECT_REF, SERVICE_ROLE_KEY 교체):
```sql
SELECT cron.schedule(
  'crawl-ai-trends',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/crawl',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);
```

## 2. Frontend 배포

### 로컬 개발
```bash
cd frontend
npm install
cp .env.example .env
# .env 파일에 Supabase URL과 Anon Key 입력
npm run dev
```

### Vercel 배포
```bash
cd frontend
vercel --prod
```

환경변수 설정:
- `VITE_SUPABASE_URL` = `https://YOUR_PROJECT.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Supabase Anon Key

## 3. 수동 테스트

크롤링 수동 실행:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/crawl \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

분석 수동 실행:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/analyze \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 기술 스택
- **Frontend**: React + Vite + Vercel
- **Backend**: Supabase (PostgreSQL + Edge Functions + pg_cron)
- **AI 분석**: Claude API (Sonnet)
- **알림**: Solapi SMS/카카오톡

## 월 비용
- Supabase Free Tier: $0
- Vercel Free Tier: $0
- Claude API: ~$0.5/월 (일 1회 분석)
- **합계: 사실상 무료**
