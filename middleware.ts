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
  console.log('🔍 미들웨어 실행:', req.nextUrl.pathname);
  console.log('🔍 리다이렉트 여부 확인 경로:', req.nextUrl.pathname.startsWith('/admin') ? '관리자 경로' : '일반 경로');
  
  // 쿠키 상세 정보 출력
  console.log('🔍 쿠키 정보:');
  req.cookies.getAll().forEach(cookie => {
    console.log(`- ${cookie.name}: ${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}`);
  });
  
  // Supabase 관련 쿠키 체크
  console.log('🔍 Supabase 쿠키 확인:');
  console.log(`- 액세스 토큰: ${req.cookies.has(accessCookie) ? '있음' : '없음'}`);
  console.log(`- 리프레시 토큰: ${req.cookies.has(refreshCookie) ? '있음' : '없음'}`);
  console.log(`- 인증 토큰: ${req.cookies.has(authCookie) ? '있음' : '없음'}`);
  
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  console.log('🔍 Supabase 세션:', session ? '세션 있음' : '세션 없음');
  
  if (session) {
    console.log('🔍 세션 상세 정보:');
    console.log(`- 사용자 ID: ${session.user.id}`);
    console.log(`- 이메일: ${session.user.email}`);
    console.log(`- 만료 시간: ${new Date(session.expires_at! * 1000).toLocaleString()}`);
    console.log(`- 현재 시간: ${new Date().toLocaleString()}`);
    console.log(`- 만료까지 남은 시간: ${Math.round((session.expires_at! * 1000 - Date.now()) / 1000 / 60)} 분`);
  }

  // 보호된 라우트 목록
  const protectedRoutes = PROTECTED_ROUTES;
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');

  // 미인증 상태에서의 처리
  if (!session) {
    console.log('🔍 세션 없음, 경로 체크:', req.nextUrl.pathname);
    
    // 관리자 경로는 항상 로그인으로 리다이렉트
    if (isAdminRoute) {
      console.log('🔍 관리자 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 다른 보호된 경로도 로그인으로 리다이렉트
    if (isProtectedRoute) {
      console.log('🔍 보호된 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 나머지 경로는 통과
    console.log('🔍 보호되지 않은 경로, 통과');
  } else {
    console.log('🔍 세션 있음, 사용자:', session.user.email);
    
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