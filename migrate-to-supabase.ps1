Write-Host "=== Supabase 마이그레이션 시작 ===" -ForegroundColor Green

# 1. 로그 디렉토리 생성
Write-Host "1. 로그 디렉토리 생성 중..." -ForegroundColor Cyan
if (-not (Test-Path -Path "logs")) {
    New-Item -Path "logs" -ItemType Directory | Out-Null
    Write-Host "   로그 디렉토리가 생성되었습니다." -ForegroundColor Green
} else {
    Write-Host "   로그 디렉토리가 이미 존재합니다." -ForegroundColor Yellow
}

# 2. 환경 변수 설정
Write-Host "2. 환경 변수 설정 중..." -ForegroundColor Cyan
$env:NEXT_PUBLIC_SUPABASE_URL = "https://jdubrjczdyqqtsppojgu.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbB"
Write-Host "   환경 변수가 설정되었습니다." -ForegroundColor Green

# 3. 마이그레이션 스크립트 실행
Write-Host "3. 마이그레이션 스크립트 실행 중..." -ForegroundColor Cyan
Write-Host "   옵션 1: node lib/scripts/migrate-data.js" -ForegroundColor White
Write-Host "   옵션 2: node --loader ts-node/esm scripts/migrate-to-supabase.ts (ESM 모듈)" -ForegroundColor White
Write-Host "   옵션 3: pnpm migrate:to:supabase" -ForegroundColor White

$option = Read-Host -Prompt "실행할 옵션 번호를 입력하세요 (1-3)"

switch ($option) {
    "1" {
        Write-Host "   node lib/scripts/migrate-data.js 실행 중..." -ForegroundColor Yellow
        node lib/scripts/migrate-data.js
    }
    "2" {
        Write-Host "   node --loader ts-node/esm scripts/migrate-to-supabase.ts 실행 중..." -ForegroundColor Yellow
        node --loader ts-node/esm scripts/migrate-to-supabase.ts
    }
    "3" {
        Write-Host "   pnpm migrate:to:supabase 실행 중..." -ForegroundColor Yellow
        pnpm migrate:to:supabase
    }
    default {
        Write-Host "잘못된 옵션을 선택했습니다." -ForegroundColor Red
        exit 1
    }
}

# 4. 마이그레이션 완료
Write-Host "4. 마이그레이션 완료" -ForegroundColor Green
Write-Host "   로그 파일은 logs 디렉토리에서 확인하세요." -ForegroundColor Cyan
Write-Host "   애플리케이션을 다시 시작하려면 pnpm dev를 실행하세요." -ForegroundColor Cyan

Write-Host "계속하려면 아무 키나 누르세요..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 