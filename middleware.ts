import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// ✅ Supabase 프로젝트 Ref (프로젝트 URL에서 확인 가능)
const projectRef = 'jdubrjczdyqqtsppojgu';
const accessCookie = `sb-${projectRef}-access-token`;
const refreshCookie = `sb-${projectRef}-refresh-token`;
const authCookie = `sb-${projectRef}-auth-token`;
const authStatusCookie = 'auth-status';
const devToken = 'dev-test-token';

// ✅ 보호 경로 목록
const PROTECTED_ROUTES = [
  '/proxy-ticketing',
  '/ticket-cancellation',
  '/tickets',
];

// ✅ 보호된 API 경로
const PROTECTED_API_ROUTES = [
  '/api/chat/init-room',
];

export async function middleware(request: NextRequest) {
  console.log('[미들웨어] 요청 경로:', request.nextUrl.pathname);
  
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  try {
    // ✅ Edge 함수에서 환경변수 수동 삽입 (env가 안 먹힘)
    const supabaseUrl = 'https://jdubrjczdyqqtsppojgu.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // 실제 키 그대로
    
    // 모든 요청에 대해 Supabase 클라이언트 생성 (중요: 모든 요청에서 인증 쿠키 갱신)
    const supabase = createMiddlewareClient<Database>({
      req: request,
      res: response,
    });
    
    // 세션 가져오기 - 이 호출로 인해 쿠키가 자동으로 갱신됨
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[미들웨어] 세션 확인 및 쿠키 갱신 완료:', session ? '✅ 세션 있음' : '❌ 세션 없음');

    // 1. API 라우트 처리 (Chat API 전용 보호)
    if (PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))) {
      console.log('[미들웨어] 보호된 API 경로 요청:', pathname);
      
      // 모든 가능한 쿠키 확인
      console.log('[미들웨어] 인증 쿠키 점검:');
      const cookies = {
        access: request.cookies.get(accessCookie)?.value,
        refresh: request.cookies.get(refreshCookie)?.value,
        auth: request.cookies.get(authCookie)?.value,
        status: request.cookies.get(authStatusCookie)?.value,
      };
      
      console.log(`- 액세스 토큰: ${cookies.access ? '✅ 존재' : '❌ 없음'}`);
      console.log(`- 리프레시 토큰: ${cookies.refresh ? '✅ 존재' : '❌ 없음'}`);
      console.log(`- 인증 토큰: ${cookies.auth ? '✅ 존재' : '❌ 없음'}`);
      console.log(`- 인증 상태: ${cookies.status || '❌ 없음'}`);
      
      // Authorization 헤더 확인
      const authHeader = request.headers.get("Authorization");
      console.log('- Authorization 헤더:', authHeader ? '✅ 존재' : '❌ 없음');
      
      // CORS OPTIONS 요청은 항상 허용 (preflight)
      if (request.method === 'OPTIONS') {
        console.log('[미들웨어] CORS OPTIONS 요청 허용');
        return new NextResponse(null, { status: 204 });
      }
      
      // 개발 환경에서 테스트 토큰 자동 주입 (테스트 편의성)
      if (process.env.NODE_ENV === 'development') {
        console.log('[미들웨어] 개발 환경 - 테스트 토큰 체크');
        
        // 이미 Authorization 또는 쿠키가 있으면 그것을 사용
        if (authHeader || cookies.access || cookies.auth) {
          console.log('[미들웨어] 기존 인증 정보 존재, 테스트 토큰 주입 생략');
        } else {
          console.log('[미들웨어] ⚠️ 개발 환경: 테스트 토큰 자동 주입');
          response.headers.set('Authorization', `Bearer ${devToken}`);
          return response;
        }
      }
      
      // 세션이 없고 인증 수단이 없으면 401 반환
      if (!session && !authHeader && !cookies.access && !cookies.auth && !cookies.status) {
        console.warn('[미들웨어] ❌ API 인증 실패 (세션/토큰 없음)');
        return NextResponse.json(
          { error: '인증되지 않은 사용자입니다.', code: 'auth/unauthorized' },
          { status: 401 }
        );
      }
      
      return response;
    }

    // 2. 일반 페이지 라우트 처리
    // 세션은 이미 위에서 확인했으므로 중복 호출 제거

    // 일반 페이지 보호 경로
    const isProtectedPage = PROTECTED_ROUTES.some(route =>
      pathname.startsWith(route) && !pathname.startsWith('/api')
    );

    if (isProtectedPage && !session) {
      console.warn('[미들웨어] ❌ 페이지 보호 경로에 인증되지 않은 접근 → 로그인 리다이렉트');
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (error) {
    console.error('[미들웨어] 오류 발생:', error);
    return response;
  }
}

// ✅ App Router용 matcher 설정 - 정규식 오류 수정
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}; 