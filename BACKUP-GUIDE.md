# 프로젝트 백업 가이드

이 문서는 네이버 클론 프로젝트의 깃과 깃허브 백업 절차에 대한 안내입니다.

## 현재 백업 상태

- 깃 저장소가 이미 초기화되어 있습니다.
- 원격 저장소(GitHub)가 설정되어 있습니다: `https://github.com/letsssss/naver.git`
- 마지막 커밋 이후로 다음 변경 사항이 있습니다:
  - Supabase 마이그레이션 스크립트 타입 오류 수정
  - 실시간 기능 구현을 위한 기반 코드 추가
  - 알림 컴포넌트 및 훅 구현
  - README.md 파일 업데이트

## 백업 절차

### 1. PowerShell에서 수동 백업

PowerShell을 관리자 권한으로 실행한 후 다음 명령을 실행하세요:

```powershell
# 프로젝트 디렉토리로 이동
cd C:\Users\jinseong\Desktop\naver_clone

# 깃 상태 확인
git status

# 모든 변경 사항 스테이징
git add .

# 커밋 생성
git commit -m "Supabase 마이그레이션 및 실시간 기능 구현"

# 변경 사항 깃허브에 푸시
git push origin master
```

### 2. 백업 스크립트 사용 (옵션)

백업 스크립트 `git-backup.ps1`이 생성되어 있습니다. 이를 사용하려면:

```powershell
# 스크립트 실행 권한 설정
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 스크립트 실행
.\git-backup.ps1
```

### 3. 깃 GUI 도구 사용 (대안)

명령줄 도구가 작동하지 않는 경우, 다음 GUI 도구를 사용할 수 있습니다:

- GitHub Desktop: https://desktop.github.com/
- SourceTree: https://www.sourcetreeapp.com/
- GitKraken: https://www.gitkraken.com/

### 4. VSCode 사용 (추천)

VSCode에서 소스 제어 탭을 통해 변경 사항을 커밋하고 푸시할 수 있습니다:

1. VSCode 좌측 소스 제어 아이콘 클릭
2. 변경된 파일 검토
3. 메시지 입력 후 커밋 버튼 클릭
4. 푸시 버튼 클릭하여 원격 저장소에 변경 사항 전송

## 백업 확인

백업이 완료되면 GitHub 리포지토리 페이지에서 변경 사항이 반영되었는지 확인하세요:
https://github.com/letsssss/naver

## 향후 백업 계획

- 중요한 기능 변경 후에는 항상 커밋하고 푸시하세요.
- 커밋 메시지는 명확하게 작성하세요.
- 대규모 변경 사항은 별도의 브랜치에서 작업하는 것이 좋습니다.

## 문제 해결

백업 과정에서 문제가 발생한 경우:

1. 인증 문제: GitHub 자격 증명이 올바른지 확인하세요.
2. 원격 저장소 연결 문제: 네트워크 연결을 확인하세요.
3. 충돌 문제: 로컬 변경 사항과 원격 저장소의 충돌을 해결하세요.

추가 도움이 필요하면 GitHub 문서를 참조하세요: https://docs.github.com/ko 