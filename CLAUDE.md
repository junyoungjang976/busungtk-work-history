# CLAUDE.md - 부성티케이 프로젝트 운영 규칙

## 회사/개발 컨텍스트
- **회사**: 부성티케이 (HVAC/냉난방공조 전문 기업)
- **개발자**: junyoungjang976
- **GitHub**: https://github.com/junyoungjang976
- **활동 대시보드**: https://junyoungjang976.github.io/work-history/

## 프로젝트 생태계 (12개 시스템)
| 프로젝트 | 역할 | 기술 스택 | 배포 |
|----------|------|-----------|------|
| busungtk-asms | A/S 관리 시스템 | React + Vite + Supabase | Vercel |
| order-tracker | 발주 추적 | React + Vite + Supabase + Google APIs | Vercel |
| field-check | 현장 진단 | React + Vite + Supabase + Kakao Maps | Vercel |
| sales-pipeline | 영업 파이프라인 | React + Vite + Supabase + Vitest | Vercel |
| equipment-manager | 장비 관리 | React + Vite + Supabase + Chart.js | Vercel |
| hvac-mentor | HVAC 기술 가이드 | React + Vite + Supabase + Gemini AI | Vercel |
| as-diagnosis-tool | A/S 진단 도구 | Next.js 16 + Prisma + LibSQL | Vercel |
| kitchen-simulator | 주방 레이아웃 | Python + Typer + Shapely | CLI |
| portal | 통합 포털 | Static HTML | Vercel |
| purchase-data | 매입 데이터 뷰어 | Python 스크립트 | 로컬 |
| busungtk-docs | 프로젝트 문서 | Markdown | GitHub |
| work-history | 활동 대시보드 | Static HTML + Chart.js | GitHub Pages |

## 공통 기술 스택
- **Frontend**: React 18-19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL) - 대부분 프로젝트가 동일 인스턴스 공유
- **Build**: Vite / Next.js
- **Deploy**: Vercel / GitHub Pages
- **Export**: ExcelJS, jsPDF, XLSX (엑셀/PDF 내보내기)
- **Charts**: Chart.js, Recharts

## DB 공유 관계
- order-tracker와 field-check는 **동일 Supabase 프로젝트**를 공유
- 대부분의 Supabase 프로젝트가 동일 인스턴스 사용
- 하나의 스키마 변경이 여러 프로젝트에 영향을 줄 수 있음

---

## 최우선 원칙
1. 기존 기능/데이터를 깨뜨릴 가능성이 있으면 **즉시 중단하고 보고**한다.
2. 보안/권한/RLS/시크릿 관련 작업은 **승인 없이 진행하지 않는다**.
3. 한 번에 크게 바꾸지 않는다. (**작게, 자주, 검증하며**)
4. 결정 권한은 항상 사용자에게 있으며, Claude는 실행 담당이다.

---

## 수정 가능 / 금지 영역

### 수정 가능
- src/, app/, pages/, components/, lib/, utils/

### 절대 수정 금지 (승인 없이)
- .env, .env.* (API 키, DB 키 포함)
- Supabase RLS 정책(Policy)
- DB 스키마 변경 (테이블/컬럼/인덱스/트리거)
- 마이그레이션 파일 (Supabase, Prisma 모두)
- Edge Functions / Triggers
- auth 관련 핵심 흐름 (로그인/세션/권한)
- AI 프롬프트 핵심 로직 (hvac-mentor 등)
- GitHub Actions 워크플로우
- 이메일 발송 설정

위 항목이 필요하면 **"변경 제안서"를 작성하고 승인을 기다린다**.

---

## 작업 규칙

### 작업 단위
- 한 작업 = 하나의 목적
- 수정 파일은 **최대 3개** 원칙
- DB/RLS 작업은 코드 작업과 **반드시 분리**
- "겸사겸사 개선" 금지

### 작업 시작 전 사전 보고 (승인 게이트)
1. 목적 (한 문장)
2. 변경 범위 (수정 파일/폴더 목록)
3. 위험도 (낮음/중간/높음) + 이유
4. 롤백 계획

사용자 승인 없이는 작업을 시작하지 않는다.

---

## Supabase 안전 규칙

### RLS(권한) 규칙
- RLS/Policy 절대 임의 수정 금지
- 필요 시 "정책 제안서" 작성:
  - 대상 테이블/행
  - 대상 역할/사용자
  - 허용/차단 조건 (select/insert/update/delete)
  - 보안상 위험 포인트

### DB 스키마/마이그레이션 규칙
- "스키마 변경 설계안" 먼저 승인:
  - 변경 전/후 스키마 요약
  - 데이터 마이그레이션 필요 여부
  - 다운타임/리스크
  - 되돌리는 방법
- **DB를 공유하는 프로젝트 영향도 반드시 확인**

### SQL 실행 안내
- SQL 실행이 필요할 때 **왜 해야 하는지 쉽게 설명**
- 예: "사진 메타데이터를 저장하려면 데이터베이스에 칸(컬럼)이 필요해서 추가합니다"

---

## 구현 규칙
작업 후 반드시 **자연어로 설명**한다:
- 무엇을 바꿨는지
- 왜 바꿨는지
- 사용자가 체감하는 변화
- 바꾸지 않으면 어떤 문제가 있었는지

코드 설명은 선택 사항이며, 이해 가능한 수준으로만 한다.

---

## 검증 규칙
코드 수정 후 가능한 범위에서 반드시 수행:
- lint
- typecheck (있다면)
- test (있다면 - Vitest, pytest 등)
- dev 서버 실행 또는 빌드

실패 시:
- 에러 로그를 그대로 붙이지 말고 **원인을 한글로 요약**
- 해결책 1~2개 제시
- **임의로 계속 진행하지 않는다** (중단 후 질문)

---

## 결과 보고 포맷
작업 완료 시:
- 변경된 파일 목록
- 핵심 변경 요약 (비개발자도 이해 가능)
- 확인이 필요한 사용자 체크리스트 (3개 이내)
- 다음 작업 제안 (우선순위 포함)

---

## Git 운영
- 작업 시작: feature 브랜치 생성
- 커밋: 작은 단위(목적별)로
- 커밋 메시지 접두사: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- 큰 변경은 PR 단위로 분리
- 불확실하면 커밋 전에 중단하고 질문
- 배포/push/commit은 사용자가 "작업 끝났다"라고 말할 때 물어보고 진행
