# 카카오톡 알림 기능 설정 가이드

이 문서는 Supabase와 SOLAPI(구 Coolsms)를 사용하여 새 메시지 발생 시 카카오톡 알림을 발송하는 기능을 설정하는 방법을 안내합니다.

## 1. 필요한 계정 및 API 키 준비

### SOLAPI(구 Coolsms) 설정
1. [SOLAPI 홈페이지](https://www.solapi.com/)에서 회원가입 및 로그인
2. API 키 발급받기: 
   - 마이페이지 > API키 관리에서 API 키(SOLAPI_API_KEY)와 API 시크릿(SOLAPI_API_SECRET) 확인
3. 카카오톡 비즈니스 채널 연동:
   - 마이페이지 > 플러스친구 관리에서 카카오톡 비즈니스 채널 연동
   - 발신 프로필 키(SOLAPI_SENDER_KEY) 확인
4. 알림톡 템플릿 등록:
   - 마이페이지 > 템플릿 관리에서 새 알림톡 템플릿 등록
   - 승인된 템플릿 코드(SOLAPI_TEMPLATE_CODE) 확인

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일에 다음 환경 변수를 추가합니다:

```
# SOLAPI 설정
SOLAPI_API_KEY=your_api_key
SOLAPI_API_SECRET=your_api_secret
SOLAPI_SENDER_KEY=your_sender_key
SOLAPI_TEMPLATE_CODE=your_template_code
SENDER_PHONE=your_sender_phone_number

# Supabase 서비스 롤 키 (이미 설정되어 있을 수 있음)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 웹훅 URL 설정 (Supabase에서 사용)
WEBHOOK_URL=https://your-domain.com/api/send-kakao
```

## 3. Supabase HTTP Extension 활성화

Supabase Studio에서 다음 단계를 따라 HTTP Extension을 활성화합니다:

1. Supabase 프로젝트 대시보드 접속
2. SQL 에디터 클릭
3. 다음 SQL 쿼리 실행:

```sql
create extension if not exists http with schema extensions;
```

4. 추가로 webapp_url 설정이 필요합니다:

```sql
alter database postgres set app.settings.webapp_url = 'https://your-domain.com';
```

## 4. SQL 마이그레이션 실행

`supabase/migrations/20240101000000_create_message_notification_trigger.sql` 파일에 있는 SQL 스크립트를 실행합니다.

1. Supabase CLI를 통해 마이그레이션 적용:
```bash
supabase db push
```

또는 

2. Supabase Studio의 SQL 에디터에서 파일 내용을 복사하여 직접 실행

## 5. 테스트

1. 웹 애플리케이션에서 새 메시지 전송
2. 수신자가 오프라인 상태일 경우 카카오톡 알림이 발송되는지 확인
3. Supabase의 `notification_logs` 테이블에서 로그 확인

## 트러블슈팅

### 알림이 전송되지 않는 경우
1. Supabase 함수 로그 확인
   - Supabase 대시보드 > Database > Functions 에서 `notify_new_message` 함수 로그 확인
2. API 로그 확인
   - Vercel 또는 호스팅 서비스의 로그에서 `/api/send-kakao` 엔드포인트 호출 로그 확인
3. 환경 변수 확인
   - 모든 필수 환경 변수가 올바르게 설정되었는지 확인

### SOLAPI 오류
SOLAPI 대시보드에서 메시지 전송 로그와 오류 코드를 확인하세요. 