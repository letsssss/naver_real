# Supabase 인증 시스템 가이드

## 개요

이 프로젝트는 Supabase 인증 시스템을 사용하여 사용자 인증을 처리합니다. 로그인/새로고침 시 auth-token, access-token, refresh-token이 자동으로 쿠키에 설정됩니다.

## 구현 방식

### 1. 미들웨어를 통한 인증 토큰 자동 설정

`middleware.ts` 파일에서 `createMiddlewareClient`를 사용하여 모든 요청에서 Supabase 세션을 확인하고 쿠키를 자동으로 갱신합니다.

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Supabase 클라이언트 생성 (중요: 모든 요청에서 인증 쿠키 갱신)
  const supabase = createMiddlewareClient({ req: request, res: response });
  
  // 세션 가져오기 - 이 호출로 인해 쿠키가 자동으로 갱신됨
  await supabase.auth.getSession();
  
  return response;
}
```

### 2. 클라이언트에서 auth-helpers 활용

클라이언트 측에서는 `createBrowserClient` 또는 `createClientComponentClient` 함수를 사용하여 Supabase 클라이언트를 생성합니다. 이 클라이언트는 쿠키 기반 인증을 자동으로 처리합니다.

```typescript
// lib/supabase.ts
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

export function createBrowserClient() {
  return createPagesBrowserClient({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY,
  });
}
```

### 3. auth-context에서 세션 관리

`auth-context.tsx`에서는 `createBrowserClient`를 활용하여 세션을 확인하고 관리합니다.

```typescript
// contexts/auth-context.tsx
import { createBrowserClient } from "@/lib/supabase";

const checkAuthStatus = async () => {
  const browserClient = createBrowserClient();
  const { data } = await browserClient.auth.getSession();
  // ...
};
```

## 인증 플로우

1. 사용자가 로그인하면 Supabase에서 세션을 생성하고 이를 auth-helpers에서 자동으로 쿠키에 저장합니다.
2. 페이지를 이동하거나 새로고침할 때 미들웨어가 실행되어 세션 쿠키를 확인하고 필요시 갱신합니다.
3. API 요청 시 쿠키에 저장된 세션 정보를 사용하여 인증됩니다.

## 디버깅

인증 관련 문제가 발생한 경우:

1. 브라우저 개발자 도구의 네트워크 탭에서 요청 헤더와 쿠키를 확인합니다.
2. 콘솔 로그에서 `[미들웨어]` 또는 `✅` 로 시작하는 로그를 확인합니다.
3. API 응답에서 401 오류가 발생하면 세션 쿠키가 제대로 설정되었는지 확인합니다.

## 관련 파일

- `middleware.ts`: 미들웨어 설정
- `lib/supabase.ts`: Supabase 클라이언트 생성 함수
- `contexts/auth-context.tsx`: 인증 상태 관리
- `app/api/chat/init-room/route.ts`: API 엔드포인트에서 인증 처리 예시 