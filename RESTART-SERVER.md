# 개발 서버 재시작 가이드

## 변경 사항 적용을 위한 서버 재시작

1. **터미널에서 현재 실행 중인 Node.js 프로세스 종료:**

```powershell
# Windows에서 실행
taskkill /F /FI "IMAGENAME eq node.exe"
```

2. **개발 서버 다시 시작:**

```powershell
cd C:\Users\jinseong\Desktop\naver_clone
pnpm dev
```

3. **서버 시작 로그 확인:**
   
   다음과 같은 출력이 표시되어야 합니다:
   ```
   > my-v0-project@0.1.0 dev C:\Users\jinseong\Desktop\naver_clone
   > next dev
   ```
   
   및 포트 정보:
   ```
   - Local:        http://localhost:3002
   (또는 다른 사용 가능한 포트)
   ```

## 변경 사항 확인

1. **브라우저에서 Posts API 엔드포인트 테스트:**
   - 브라우저를 열고 `http://localhost:3002/api/posts` (또는 해당하는 포트) 방문
   - 유효한 JSON 응답이 표시되는지 확인

2. **서버 로그에서 다음 내용 확인:**
   - "글 목록 API 호출됨" 메시지
   - "토큰 정보: 토큰 있음" 또는 "토큰 정보: 토큰 없음" 메시지
   - "개발 환경에서 Supabase 검증 시도 중..." 메시지
   - 데이터베이스 쿼리 관련 로그

3. **성공적인 응답 내용:**
   - `success: true`가 포함된 JSON 응답
   - `posts` 배열 및 `pagination` 정보 표시

## 문제 해결

- **포트 충돌 발생 시:**
  - 출력된 다른 포트 번호를 사용해 접속 시도
  - 또는 이전에 작성한 `scripts/clear-ports.ps1` 스크립트 실행 후 서버 재시작

- **Supabase 오류 발생 시:**
  - `.env.local` 파일에 임시 환경 변수 설정 확인
  - 개발 환경에서 모의 클라이언트 폴백이 제대로 작동하는지 확인

- **데이터베이스 연결 오류 발생 시:**
  - 로컬 SQLite 데이터베이스 파일 존재 여부 확인
  - Prisma 초기화 로그 확인 