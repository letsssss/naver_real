# 환경 변수 설정
$env:NEXT_PUBLIC_SUPABASE_URL = "https://jdubrjczdyqqtsppojgu.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU"
$env:JWT_SECRET = "VQdBIUpYWVl6tLzN9RTUZrDGLkJ70HbaTgy5x12qeDRW95tAKrN5lT7jnOj9borDCSVKHQi2e/ERbAQA5uoK3w=="
$env:DATABASE_URL = "postgresql://postgres:young0503!@db.jdubrjczdyqqtsppojgu.supabase.co:5432/postgres"

# 앱 실행
Write-Host "환경 변수가 설정되었습니다." -ForegroundColor Green
Write-Host "Supabase 연결 정보가 구성되었습니다." -ForegroundColor Yellow
Write-Host "애플리케이션을 시작합니다..." -ForegroundColor Cyan
pnpm dev 