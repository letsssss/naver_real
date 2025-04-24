@echo off
chcp 65001 > nul

git add .
git commit -m "backup: %date% %time%"
git push origin master

echo 백업 완료
pause 