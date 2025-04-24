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
  '/mypage',
];

// ✅ 보호된 API 경로
const PROTECTED_API_ROUTES = [
  '/api/chat/init-room',
  '/api/notifications',
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  console.log('[MW] 받은 쿠키:', req.cookies);
  
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  console.log('[MW] Supabase 세션:', session);

  // 보호된 라우트 목록
  const protectedRoutes = ['/tickets', '/proxy-ticketing', '/ticket-cancellation', '/mypage'];
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  if (isProtectedRoute && !session) {
    // 로그인 페이지로 리다이렉트하고 원래 가려던 URL을 쿼리 파라미터로 저장
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// ✅ App Router용 matcher 설정 - 정규식 오류 수정
export const config = {
  matcher: [
    '/tickets/:path*',
    '/proxy-ticketing/:path*',
    '/ticket-cancellation/:path*',
    '/mypage/:path*',
    '/api/:path*'
  ],
}; 