# Supabase 마이그레이션 단계

## 1. 사전 준비

1. **환경 변수 설정**
   - `.env.local` 파일에 다음 환경 변수가 설정되어 있는지 확인:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 마이그레이션에 필요
     ```

2. **Supabase 프로젝트 설정**
   - Supabase 대시보드에서 프로젝트 상태 확인
   - 데이터베이스 정상 작동 확인

## 2. Supabase 테이블 생성

1. Supabase 대시보드에 로그인
2. 해당 프로젝트로 이동 후 SQL 에디터 열기
3. `lib/scripts/create-tables.sql` 파일의 내용을 복사하여 SQL 에디터에 붙여넣고 실행
4. 테이블이 올바르게 생성되었는지 확인:
   - `users` 테이블
   - `posts` 테이블
   - `notifications` 테이블

## 3. 데이터 마이그레이션 실행

1. 다음 명령어를 사용하여 마이그레이션 스크립트 실행:
   ```
   node lib/scripts/migrate-data.js
   ```
   또는
   ```
   pnpm migrate:to:supabase
   ```

2. 마이그레이션 실행 중 로그 확인:
   - 사용자 마이그레이션 진행 상황
   - 게시물 마이그레이션 진행 상황
   - 알림 마이그레이션 진행 상황

3. 오류 발생 시 처리:
   - 연결 문제: Supabase URL과 키 확인
   - 테이블 스키마 문제: SQL 스크립트 재확인
   - 데이터 변환 문제: 데이터 형식 변환 로직 확인

## 4. 마이그레이션 확인

1. Supabase 대시보드에서 마이그레이션된 데이터 확인:
   - `users` 테이블 데이터 확인
   - `posts` 테이블 데이터 확인
   - `notifications` 테이블 데이터 확인

2. 데이터 무결성 확인:
   - 사용자 수 일치 여부
   - 게시물 수 일치 여부
   - 알림 수 일치 여부

## 5. 코드 수정 확인

대부분의 Supabase 관련 코드 수정은 이미 완료되었습니다. 다음 사항 확인:

1. **Supabase 클라이언트 초기화**:
   - `lib/supabase.ts` 파일에서 클라이언트 초기화 확인
   - 환경 변수 설정 확인

2. **API 엔드포인트**:
   - Prisma 대신 Supabase를 호출하는지 확인
   - 오류 처리 및 폴백 메커니즘 작동 확인

3. **실시간 기능**:
   - Supabase 채널 구독 확인
   - 이벤트 핸들러 작동 확인

## 6. 최종 테스트

1. **API 테스트**:
   - 로그인/회원가입 기능 테스트
   - 게시물 CRUD 기능 테스트
   - 알림 기능 테스트

2. **실시간 기능 테스트**:
   - `RealTimeNotifications` 컴포넌트 작동 확인
   - 알림 실시간 수신 테스트
   - 알림 읽음 상태 변경 테스트

## 7. 배포 준비

1. **환경 변수 설정**:
   - 프로덕션 환경에서 필요한 모든 환경 변수 설정
   - Supabase URL과 키 설정

2. **빌드 및 배포**:
   - 애플리케이션 빌드
   - 배포 환경 설정
   - 최종 배포 및 모니터링

## 문제 해결

1. **마이그레이션 스크립트 실행 오류**:
   - Node.js 버전 확인 (14 이상 권장)
   - 필요한 패키지 설치 여부 확인
   - 환경 변수 설정 확인

2. **Supabase 연결 오류**:
   - Supabase 프로젝트 상태 확인
   - URL 및 키 정확성 확인
   - 네트워크 연결 확인

3. **데이터 변환 오류**:
   - 데이터 형식 확인 (특히 날짜, JSON 데이터)
   - BigInt와 같은 특수 데이터 타입 처리 확인

## 롤백 계획

마이그레이션 실패 시 다음 단계로 롤백 진행:

1. Supabase 테이블 데이터 삭제
2. 애플리케이션 코드를 Prisma 버전으로 롤백
3. Prisma 데이터베이스 재사용 