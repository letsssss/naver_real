# 깃 백업 스크립트

# 현재 상태 출력
Write-Host "===== 깃 상태 확인 =====" -ForegroundColor Green
git status

# 변경된 파일 스테이징
Write-Host "`n===== 변경된 파일 스테이징 =====" -ForegroundColor Green
git add .

# 커밋 메시지 작성
$commitMessage = "Supabase 마이그레이션 및 실시간 기능 구현"
Write-Host "`n===== 커밋 메시지: $commitMessage =====" -ForegroundColor Green
git commit -m $commitMessage

# 원격 저장소 정보 출력
Write-Host "`n===== 원격 저장소 정보 =====" -ForegroundColor Green
git remote -v

# 변경 사항 푸시
Write-Host "`n===== 변경 사항 푸시 =====" -ForegroundColor Green
git push origin master

Write-Host "`n===== 백업 완료 =====" -ForegroundColor Green 