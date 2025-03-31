# Posts API 테스트 가이드

## 변경 사항 요약

1. **Supabase 지원 추가**
   - Supabase 클라이언트 가져오기 추가
   - 개발 환경에서 모의 클라이언트 사용 로직 구현
   - 토큰 검증 및 인증 로직 강화

2. **개발 환경 폴백 메커니즘**
   - 환경 변수가 없는 경우에도 개발 환경에서 작동하도록 수정
   - 기본 테스트 사용자 ID(3) 사용하여 개발 가능

## API 테스트 방법

### 1. 브라우저에서 직접 테스트

아래 URL을 브라우저에서 열어 테스트할 수 있습니다:

```
http://localhost:3002/api/posts
또는
http://localhost:3003/api/posts
```

> 참고: 실제 포트는 개발 서버 시작 시 콘솔에 표시된 번호를 사용하세요.

### 2. 새 게시물 작성 테스트 (Postman 또는 REST 클라이언트 필요)

**URL**: `http://localhost:3002/api/posts` (또는 해당하는 포트)

**메서드**: POST

**헤더**:
```
Content-Type: application/json
```

**요청 본문**:
```json
{
  "title": "테스트 게시물",
  "content": "이것은 Supabase 테스트를 위한 게시물입니다. 최소 10자 이상이어야 합니다.",
  "category": "GENERAL"
}
```

## 예상 결과

### GET 요청 성공시:
```json
{
  "success": true,
  "posts": [],
  "pagination": {
    "totalCount": 0,
    "totalPages": 0,
    "currentPage": 1,
    "hasMore": false
  }
}
```

### POST 요청 성공시:
```json
{
  "success": true,
  "message": "글이 성공적으로 작성되었습니다.",
  "post": {
    "id": "...",
    "title": "테스트 게시물",
    "content": "이것은 Supabase 테스트를 위한 게시물입니다. 최소 10자 이상이어야 합니다.",
    "category": "GENERAL",
    "authorId": 3,
    "createdAt": "..."
  }
}
```

## 문제 해결

서버 로그를 확인하여 다음 내용을 확인하세요:

1. "개발 환경에서 기본 사용자 ID(3) 사용" 메시지가 표시되는지
2. Supabase 클라이언트 관련 로그가 오류 없이 출력되는지
3. 데이터베이스 연결이 성공적으로 이루어지는지

만약 "Supabase URL이나 Anon Key가 설정되지 않았습니다" 오류가 계속 발생하면, `.env.local` 파일에 다음 내용을 추가하세요:

```
NEXT_PUBLIC_SUPABASE_URL=any-value
NEXT_PUBLIC_SUPABASE_ANON_KEY=any-value
```

이는 개발 환경에서만 사용되는 임시 값으로, 실제 Supabase 값을 설정하기 전까지 테스트 용도로만 사용됩니다. 