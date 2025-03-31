# 네이버 클론 프로젝트: Supabase 마이그레이션 가이드

## 프로젝트 개요

이 프로젝트는 원래 Prisma와 로컬 SQLite 데이터베이스를 사용하는 애플리케이션을 Supabase로 마이그레이션하는 과정을 다룹니다. 이 마이그레이션은 다음 목표를 달성하기 위해 진행됩니다:

1. 클라우드 기반 데이터베이스 솔루션으로 이전
2. 실시간 기능 (알림, 채팅) 강화
3. 인증 시스템 개선
4. 확장성 향상

## 설치 및 실행 방법

```bash
# 패키지 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 설정해야 합니다:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
DATABASE_URL=your-database-url
```

## 주요 기능

- 사용자 인증 (JWT 토큰 기반)
- 게시글 작성 및 조회
- 알림 시스템
- 티켓 거래 시스템
- 사용자 메시징

## Supabase 마이그레이션 워크플로우

### 1. 환경 설정 (완료)

- [x] `.env.local` 파일에 Supabase 관련 환경 변수 설정
- [x] Supabase 클라이언트 래퍼 구현
- [x] 개발 환경에서 모의 Supabase 클라이언트 구현

### 2. 코드 수정 (진행 중)

- [x] Supabase 연결 문제 해결
  - [x] `lib/supabase.ts` 파일 수정
  - [x] 개발 환경에서 폴백 메커니즘 구현
  
- [x] JWT 토큰 검증 개선
  - [x] `lib/auth.ts` 파일 수정
  - [x] 개발 환경에서 검증 우회 기능 추가
  
- [x] API 엔드포인트 수정
  - [x] Notifications API 수정
  - [x] Posts API ID 필드 문제 해결
  - [x] Auth API 수정

### 3. 데이터 마이그레이션 (진행 중)

- [ ] 스키마 매핑 완료
- [x] 데이터 마이그레이션 스크립트 작성
  - [x] 스크립트 기본 구조 구현
  - [x] 타입 오류 수정
  - [ ] 배치 처리 로직 최적화
- [ ] 테스트 데이터 마이그레이션
- [ ] 실제 데이터 마이그레이션

### 4. 테스트 및 검증 (진행 중)

- [x] 알림 API 엔드포인트 테스트
- [ ] 게시글 API 엔드포인트 테스트
- [ ] 인증 흐름 검증
- [x] 실시간 기능 구현 준비
- [ ] 실시간 기능 테스트

### 5. 배포 (예정)

- [ ] 프로덕션 환경 설정
- [ ] CI/CD 파이프라인 구성
- [ ] 모니터링 설정

## 문제 해결 가이드

### 포트 충돌 해결

포트 충돌이 발생하면 다음 스크립트를 실행하여 사용 중인 포트를 정리합니다:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\clear-ports.ps1
```

### Supabase 연결 오류

Supabase 연결 오류가 발생하면 다음을 확인하세요:

1. `.env.local` 파일의 환경 변수가 올바르게 설정되었는지 확인
2. Supabase 프로젝트 상태 확인
3. 개발 환경에서는 모의 클라이언트가 자동으로 사용됨

### JWT 토큰 오류

JWT 토큰 검증 오류가 발생하면 다음을 확인하세요:

1. `JWT_SECRET` 환경 변수가 올바르게 설정되었는지 확인
2. 개발 환경에서는 자동으로 기본 사용자(ID: 3)로 인증됨

## 마이그레이션 스크립트 실행

```bash
# 데이터 마이그레이션 스크립트 실행
pnpm migrate:to:supabase
```

## 깃허브 백업 및 동기화

프로젝트 변경 사항을 깃허브에 백업하려면 다음 단계를 따르세요:

### 백업 스크립트 실행

```powershell
# PowerShell 스크립트 실행 권한 설정
powershell -ExecutionPolicy Bypass -File git-backup.ps1
```

### 수동 백업 방법

```bash
# 변경 사항 확인
git status

# 변경 파일 스테이징
git add .

# 커밋 생성
git commit -m "변경 내용 설명"

# 원격 저장소에 푸시
git push origin master
```

### 새 환경에서 클론하기

```bash
# 리포지토리 클론
git clone https://github.com/letsssss/naver.git

# 디렉토리 이동
cd naver

# 패키지 설치
pnpm install

# 환경 변수 설정
# .env.local 파일 생성 및 설정

# 개발 서버 실행
pnpm dev
```

## 기여 방법

1. 이슈 생성
2. 브랜치 생성
3. 코드 변경
4. PR 제출
5. 리뷰 및 병합

## 라이선스

MIT 