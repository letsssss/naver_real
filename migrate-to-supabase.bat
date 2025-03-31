@echo off
echo === Supabase 마이그레이션 시작 ===

echo 1. 로그 디렉토리 생성 중...
if not exist logs mkdir logs

echo 2. 환경 변수 설정 중...
set NEXT_PUBLIC_SUPABASE_URL=https://jdubrjczdyqqtsppojgu.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbB

echo 3. 마이그레이션 스크립트 실행 중...
echo 옵션 1: node lib/scripts/migrate-data.js
echo 옵션 2: node --loader ts-node/esm scripts/migrate-to-supabase.ts (ESM 모듈)
echo 옵션 3: pnpm migrate:to:supabase

set /p option="실행할 옵션 번호를 입력하세요 (1-3): "

if "%option%"=="1" (
  echo node lib/scripts/migrate-data.js 실행 중...
  node lib/scripts/migrate-data.js
) else if "%option%"=="2" (
  echo node --loader ts-node/esm scripts/migrate-to-supabase.ts 실행 중...
  node --loader ts-node/esm scripts/migrate-to-supabase.ts
) else if "%option%"=="3" (
  echo pnpm migrate:to:supabase 실행 중...
  pnpm migrate:to:supabase
) else (
  echo 잘못된 옵션을 선택했습니다.
  exit /b 1
)

echo 4. 마이그레이션 완료
echo 로그 파일은 logs 디렉토리에서 확인하세요.
echo 애플리케이션을 다시 시작하려면 pnpm dev를 실행하세요.

pause 