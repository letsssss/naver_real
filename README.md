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

# Prisma에서 Supabase로 마이그레이션된 프로젝트

## 마이그레이션 요약

이 프로젝트는 Prisma ORM에서 Supabase로 마이그레이션되었습니다. 주요 변경 사항은 다음과 같습니다:

### 1. 데이터베이스 액세스 레이어
- `lib/prisma.ts` → `lib/supabase.ts`로 변경
- Prisma 클라이언트 대신 Supabase SDK 사용
- 데이터베이스 액세스를 위한 싱글톤 패턴 구현

### 2. 인증 시스템
- JWT 기반 인증 메커니즘 유지
- 토큰 검증 로직 강화
- 호환성을 위한 다양한 인증 방식 지원 (JWT, Supabase 세션)

### 3. API 엔드포인트
- 모든 API 라우트를 Supabase 쿼리로 리팩토링
- 표준화된 응답 형식 구현
- 오류 처리 및 로깅 기능 강화

### 4. 데이터 변환 유틸리티
- snake_case에서 camelCase로 변환하는 유틸리티 함수 제공
- 날짜 파싱 및 포맷팅 기능 통합
- ID 처리 일관성 유지 (문자열 기반)

### 5. 환경 변수 관리
- Supabase 연결을 위한 필수 환경 변수 추가
- 개발/프로덕션 환경에 따른 조건부 로직 구현
- 환경 변수 검증 로직 추가

## 실행 방법

### 환경 설정

1. `.env.local` 파일에 Supabase 연결 정보 설정:

```env
# Supabase 연결 정보
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 인증 관련 설정
JWT_SECRET=your-secret-key
JWT_ISSUER=your-issuer
JWT_AUDIENCE=your-audience
```

### 개발 서버 실행

```bash
# 패키지 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

### 프로덕션 빌드

```bash
# 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

## API 사용 예시

### 게시물 조회

```javascript
// 게시물 목록 조회
const response = await fetch('/api/posts?page=1&limit=10');
const data = await response.json();

// 단일 게시물 조회
const response = await fetch(`/api/posts?id=${postId}`);
const data = await response.json();
```

### 알림 조회

```javascript
// 인증 헤더 설정
const headers = {
  'Authorization': `Bearer ${token}`
};

// 알림 목록 조회
const response = await fetch('/api/notifications', { headers });
const data = await response.json();
```

## 마이그레이션 참고 사항

1. **인증 토큰**: 기존 JWT 토큰과 Supabase 토큰 모두 지원됨
2. **ID 형식**: Prisma는 숫자 ID, Supabase는 UUID 사용 - 형식 변환 로직 추가됨
3. **쿼리 방식**: ORM 스타일에서 빌더 패턴으로 변경
4. **타입 안전성**: 타입스크립트 인터페이스 추가로 타입 안전성 강화
5. **오류 처리**: 표준화된 오류 응답 형식 적용 