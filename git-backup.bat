@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ======================================
echo        Git 백업 스크립트 시작
echo ======================================

REM 현재 디렉토리 확인
echo [1/6] 현재 작업 디렉토리: %CD%

REM Git 저장소 확인
echo [2/6] Git 저장소 상태 확인 중...
git rev-parse --git-dir >nul 2>&1
if %errorlevel% neq 0 (
    echo 오류: 현재 폴더가 Git 저장소가 아닙니다.
    goto :error
)

REM 변경사항 확인
echo [3/6] 변경사항 확인 중...
git status
echo.

REM 변경사항 스테이징
echo [4/6] 변경사항 스테이징 중...
git add .
if %errorlevel% neq 0 (
    echo 오류: 파일 스테이징 중 문제가 발생했습니다.
    goto :error
)

REM 커밋 생성
echo [5/6] 변경사항 커밋 중...
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=!TIMESTAMP: =0!"
git commit -m "backup: !TIMESTAMP!"
if %errorlevel% neq 0 (
    echo 오류: 커밋 생성 중 문제가 발생했습니다.
    goto :error
)

REM GitHub에 푸시
echo [6/6] GitHub에 푸시 중...
git push origin master
if %errorlevel% neq 0 (
    echo 오류: GitHub 푸시 중 문제가 발생했습니다.
    goto :error
)

echo.
echo ======================================
echo        백업이 완료되었습니다!
echo ======================================
echo 백업 시간: !TIMESTAMP!
goto :end

:error
echo.
echo ======================================
echo        ⚠️ 오류가 발생했습니다!
echo ======================================
echo 오류 코드: %errorlevel%
echo 문제 해결을 위해 위의 메시지를 확인해주세요.

:end
pause 