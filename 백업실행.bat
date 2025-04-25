@echo off
chcp 65001 > nul
powershell -ExecutionPolicy Bypass -File git-backup.ps1
pause 