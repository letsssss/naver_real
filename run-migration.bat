@echo off
chcp 65001 > nul
echo ===== Supabase 마이그레이션 시작 =====
echo.

REM 로그 디렉토리 확인
if not exist logs (
    echo 로그 디렉토리 생성 중...
    mkdir logs
    echo 로그 디렉토리가 생성되었습니다.
) else (
    echo 로그 디렉토리가 이미 존재합니다.
)

REM 환경 변수 설정
echo 환경 변수 설정 중...
set NEXT_PUBLIC_SUPABASE_URL=https://jdubrjczdyqqtsppojgu.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbB
echo 환경 변수가 설정되었습니다.

REM 마이그레이션 스크립트 실행
echo 마이그레이션 스크립트 실행 중...
node run-migration.js

echo.
echo 마이그레이션이 완료되었습니다.
echo 로그 파일은 logs 디렉토리에서 확인하세요.
echo 개발 서버를 시작하려면 "pnpm dev"를 실행하세요.
echo.

pause 