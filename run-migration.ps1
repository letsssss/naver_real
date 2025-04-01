[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "===== Supabase 마이그레이션 시작 =====" -ForegroundColor Green
Write-Host ""

# 로그 디렉토리 확인
if (-not (Test-Path -Path "logs")) {
    Write-Host "로그 디렉토리 생성 중..." -ForegroundColor Cyan
    New-Item -Path "logs" -ItemType Directory | Out-Null
    Write-Host "로그 디렉토리가 생성되었습니다." -ForegroundColor Green
} else {
    Write-Host "로그 디렉토리가 이미 존재합니다." -ForegroundColor Yellow
}

# 환경 변수 설정
Write-Host "환경 변수 설정 중..." -ForegroundColor Cyan
$env:NEXT_PUBLIC_SUPABASE_URL = "https://jdubrjczdyqqtsppojgu.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbB"
Write-Host "환경 변수가 설정되었습니다." -ForegroundColor Green

# 마이그레이션 스크립트 실행
Write-Host "마이그레이션 스크립트 실행 중..." -ForegroundColor Cyan
try {
    node run-migration.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "마이그레이션이 성공적으로 완료되었습니다." -ForegroundColor Green
    } else {
        Write-Host "마이그레이션이 오류 코드 $LASTEXITCODE로 종료되었습니다." -ForegroundColor Red
    }
} catch {
    Write-Host "마이그레이션 실행 중 오류가 발생했습니다: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "마이그레이션 로그는 logs 디렉토리에서 확인하세요." -ForegroundColor Cyan
Write-Host "개발 서버를 시작하려면 'pnpm dev'를 실행하세요." -ForegroundColor Cyan
Write-Host ""

Write-Host "계속하려면 아무 키나 누르세요..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 