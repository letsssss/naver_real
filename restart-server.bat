@echo off
echo ==============================
echo 환경변수 문제 해결 도우미
echo ==============================

echo 1. 실행 중인 노드 프로세스 종료 중...
taskkill /F /IM node.exe
echo.

echo 2. .env.local 파일 확인 중...
if exist .env.local (
  echo .env.local 파일이 존재합니다.
) else (
  echo [경고] .env.local 파일이 없습니다!
  echo .env 파일을 대신 사용합니다.
)
echo.

echo 3. 환경변수 설정 중...
set NEXT_PUBLIC_SUPABASE_URL=https://jdubrjczdyqqtsppojgu.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww
echo 환경변수 설정 완료!
echo.

echo 4. 서버 시작 중...
npm run dev
echo.

echo 완료!
pause 