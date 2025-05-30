import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// ✅ Supabase 프로젝트 ID를 환경변수에서 동적으로 가져오기
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 (fallback)
  
  if (supabaseUrl) {
    // URL에서 프로젝트 ID 추출: https://[PROJECT_ID].supabase.co
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch && urlMatch[1]) {
      projectRef = urlMatch[1];
    }
  }
  
  return projectRef;
}

const projectRef = getProjectRef();
const authCookie = `sb-${projectRef}-auth-token`;
const authStatusCookie = 'auth-status';

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

// 로깅 함수
const logDebug = (message: string, data?: any) => {
  console.log(`[Middleware] ${message}`, data ? data : '');
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    // 세션 새로고침
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      logDebug('세션 새로고침 오류:', error.message);
      return res;
    }

    // API 요청에 대한 인증 처리
    if (req.nextUrl.pathname.startsWith('/api/')) {
      if (!session) {
        logDebug('API 인증 실패: 세션 없음');
        return new NextResponse(
          JSON.stringify({ error: '로그인이 필요합니다.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 세션이 있으면 요청 허용
      logDebug('API 인증 성공:', session.user.id);
      return res;
    }

    // 보호된 라우트 확인
    const isProtectedRoute = PROTECTED_ROUTES.some(route => req.nextUrl.pathname.startsWith(route));
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
    const isProtectedApiRoute = PROTECTED_API_ROUTES.some(route => req.nextUrl.pathname.startsWith(route));

    // ✅ 인증이 필요한 경로에서 세션이 없는 경우
    if (!session && (isProtectedRoute || isProtectedApiRoute)) {
      console.log('🚫 [MW] 인증 필요 - 로그인으로 리다이렉트');
      
      // API 경로는 401 응답
      if (isProtectedApiRoute) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
      }
      
      // 페이지 경로는 로그인으로 리다이렉트
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // ✅ 관리자 권한 확인 (세션이 있는 경우)
    if (session && isAdminRoute) {
      // 관리자 권한은 페이지에서 확인하도록 위임
      console.log('�� [MW] 관리자 경로 접근 - 페이지에서 권한 확인');
    }

    // ✅ 인증된 사용자의 경우 세션 정보 로깅
    if (session) {
      console.log('✅ [MW] 인증된 사용자:', {
        email: session.user.email,
        id: session.user.id,
        expires: new Date(session.expires_at! * 1000).toLocaleString()
      });
    }

    return res;
  } catch (error: any) {
    logDebug('미들웨어 오류:', error.message);
    return res;
  }
}

// ✅ App Router용 matcher 설정
export const config = {
  matcher: [
    '/mypage/:path*',
    '/sell/:path*',
    '/cart/:path*',
    '/write-post/:path*',
    '/user-info/:path*',
    '/admin/:path*',
    '/api/chat/:path*',
    '/api/notifications/:path*',
    '/api/seller-stats/:path*',
    '/api/transactions/:path*'
  ],
}; 