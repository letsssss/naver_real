# 3000~3006 포트 사용 중인 프로세스 찾기 및 종료
Write-Host "포트 충돌 해결 스크립트 실행 중..." -ForegroundColor Green

$ports = 3000..3006
$killedProcesses = 0

foreach ($port in $ports) {
    Write-Host "포트 $port 확인 중..." -ForegroundColor Yellow
    
    try {
        # 해당 포트를 사용 중인 프로세스 찾기
        $processInfo = netstat -ano | findstr ":$port"
        
        if ($processInfo) {
            Write-Host "포트 $port를 사용 중인 프로세스 발견:" -ForegroundColor Cyan
            Write-Host $processInfo -ForegroundColor Cyan
            
            # PID 추출
            $pattern = '.*:' + $port + '\s+.*\s+(\d+)'
            $pid = [regex]::Match($processInfo, $pattern).Groups[1].Value
            
            if ($pid -and $pid -ne '') {
                # 프로세스 정보 확인
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                
                if ($process) {
                    Write-Host "프로세스 이름: $($process.ProcessName), ID: $pid 종료 중..." -ForegroundColor Red
                    
                    # 프로세스 종료
                    Stop-Process -Id $pid -Force
                    Write-Host "프로세스 $pid 종료 완료" -ForegroundColor Green
                    $killedProcesses++
                } else {
                    Write-Host "해당 PID($pid)를 가진 프로세스를 찾을 수 없습니다." -ForegroundColor Magenta
                }
            } else {
                Write-Host "포트 $port를 사용 중인 프로세스의 PID를 추출할 수 없습니다." -ForegroundColor Magenta
            }
        } else {
            Write-Host "포트 $port를 사용 중인 프로세스가 없습니다." -ForegroundColor Green
        }
    } catch {
        Write-Host "오류 발생: $_" -ForegroundColor Red
    }
    
    Write-Host "---------------------------" -ForegroundColor Gray
}

Write-Host "작업 완료: 총 $killedProcesses 개의 프로세스가 종료되었습니다." -ForegroundColor Green
Write-Host "이제 'pnpm dev' 명령으로 서버를 다시 실행할 수 있습니다." -ForegroundColor Green 