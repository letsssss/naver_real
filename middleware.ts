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
  '/mypage',
  '/sell',
  '/cart',
  '/write-post',
  '/user-info',
  '/admin'
];

// ✅ 보호된 API 경로
const PROTECTED_API_ROUTES = [
  '/api/chat/init-room',
  '/api/notifications',
];

export async function middleware(req: NextRequest) {
  // 디버깅 로그 추가 - 요청 URL과 쿠키 확인
  console.log('🔍 미들웨어 URL 확인:', req.nextUrl.pathname);
  console.log('🔍 리다이렉트 여부 확인 경로:', req.nextUrl.pathname.startsWith('/admin') ? '관리자 경로' : '일반 경로');
  
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  console.log('[MW] 받은 쿠키:', req.cookies);
  
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  console.log('[MW] Supabase 세션:', session ? '세션 있음' : '세션 없음');
  console.log('[MW] 세션 사용자:', session?.user?.email || '없음');

  // 보호된 라우트 목록
  const protectedRoutes = PROTECTED_ROUTES;
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');

  // 미인증 상태에서의 처리
  if (!session) {
    console.log('[MW] 세션 없음, 경로 체크:', req.nextUrl.pathname);
    
    // 관리자 경로는 항상 로그인으로 리다이렉트
    if (isAdminRoute) {
      console.log('[MW] 관리자 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 다른 보호된 경로도 로그인으로 리다이렉트
    if (isProtectedRoute) {
      console.log('[MW] 보호된 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 나머지 경로는 통과
    console.log('[MW] 보호되지 않은 경로, 통과');
  } else {
    console.log('[MW] 세션 있음, 사용자:', session.user.email);
    
    // 세션이 있지만 관리자 권한 체크는 페이지에서 수행
  }

  return res;
}

// ✅ App Router용 matcher 설정 - 정규식 오류 수정
export const config = {
  matcher: [
    '/mypage/:path*',
    '/sell/:path*',
    '/cart/:path*',
    '/write-post/:path*',
    '/user-info/:path*',
    '/admin/:path*',
    '/api/:path*'
  ],
}; 