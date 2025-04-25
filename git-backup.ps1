# 인코딩 설정 강화
$PSDefaultParameterValues['*:Encoding'] = 'UTF8'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "UTF-8"

# 콘솔 코드페이지 변경
$null = & cmd /c chcp 65001

# 깃허브 백업 스크립트
Write-Host "🚀 깃허브 백업 시작..." -ForegroundColor Green

# 현재 시간을 커밋 메시지에 포함
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "백업: $timestamp"

# 변경사항 확인
Write-Host "📝 변경사항 확인 중..." -ForegroundColor Yellow
git status

# 모든 변경사항 스테이징
Write-Host "📦 변경사항 스테이징 중..." -ForegroundColor Yellow
git add .

# 커밋 생성
Write-Host "💾 커밋 생성 중..." -ForegroundColor Yellow
git commit -m $commitMessage

# 원격 저장소에 푸시
Write-Host "⬆️ 깃허브에 푸시 중..." -ForegroundColor Yellow
git push origin master

Write-Host "✅ 백업 완료!" -ForegroundColor Green 