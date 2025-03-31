@echo off
chcp 65001 > nul
echo ===== 깃 상태 확인 =====
git status

echo.
echo ===== 변경된 파일 스테이징 =====
git add .

echo.
echo ===== 커밋 메시지 작성 =====
set commitMessage=Supabase 마이그레이션 및 실시간 기능 구현
echo 커밋 메시지: %commitMessage%
git commit -m "%commitMessage%"

echo.
echo ===== 원격 저장소 정보 =====
git remote -v

echo.
echo ===== 변경 사항 푸시 =====
git push origin master

echo.
echo ===== 백업 완료 =====
pause 