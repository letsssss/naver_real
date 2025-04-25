@echo off
rem 콘솔 인코딩을 UTF-8로 설정
chcp 65001 > nul
rem 파워쉘 실행 시 인코딩 관련 매개변수 추가
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '%~dp0git-backup.ps1'}"
pause 