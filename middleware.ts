import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';
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

// ✅ 인증 리프레시/복구를 위한 특수 경로 (이 경로에서는 리다이렉트 하지 않음)
const AUTH_PATHS = [
  '/login',
  '/api/auth/callback',
  '/api/auth/check',
  '/api/auth/refresh'
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  
  // 디버깅 로그 추가 - 요청 URL과 쿠키 확인
  console.log('🔍 미들웨어 실행:', pathname);
  
  // 인증 관련 특수 경로는 처리를 건너뜀 (리다이렉트 없음)
  if (AUTH_PATHS.some(path => pathname.startsWith(path))) {
    console.log('🔍 인증 관련 경로, 미들웨어 검사 건너뜀:', pathname);
    return NextResponse.next();
  }
  
  // 정적 파일은 처리를 건너뜀
  if (
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|mp3|mp4|webp|webm)$/) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }
  
  console.log('🔍 리다이렉트 여부 확인 경로:', pathname);
  
  // 응답 객체 생성 (쿠키 조작을 위해 필요)
  const res = NextResponse.next();
  
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
  
  // createServerClient 사용 (@supabase/ssr)
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          // 인증 관련 쿠키에는 긴 만료 시간 설정
          if (name.includes('supabase') || name.includes('auth') || name.includes('sb-')) {
            options = {
              ...options,
              maxAge: 60 * 60 * 24 * 7, // 7일
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production'
            };
          }
          
          res.cookies.set(name, value, options);
        },
        remove(name, options) {
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
  
  // 세션 정보 가져오기
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  
  // 세션 에러 로깅
  if (sessionError) {
    console.error('🔍 세션 로드 에러:', sessionError.message);
  }
  
  console.log('🔍 Supabase 세션:', session ? '세션 있음' : '세션 없음');
  
  // 세션이 있으면 세션 정보 로깅 및 필요시 갱신
  if (session) {
    console.log('🔍 세션 상세 정보:');
    console.log(`- 사용자 ID: ${session.user.id}`);
    console.log(`- 이메일: ${session.user.email}`);
    console.log(`- 만료 시간: ${new Date(session.expires_at! * 1000).toLocaleString()}`);
    
    const expiresAt = session.expires_at! * 1000;
    const now = Date.now();
    const timeUntilExpiry = Math.round((expiresAt - now) / 1000 / 60);
    
    console.log(`- 현재 시간: ${new Date().toLocaleString()}`);
    console.log(`- 만료까지 남은 시간: ${timeUntilExpiry} 분`);
    
    // 세션 만료가 24시간 이내인 경우 서버에서 갱신 시도
    if (timeUntilExpiry < 60 * 24) {
      console.log('🔍 세션 만료가 24시간 이내, 갱신 시도');
      
      try {
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('🔍 세션 갱신 에러:', error.message);
        } else if (data.session) {
          console.log('🔍 세션 갱신 성공:', {
            newExpiresAt: new Date(data.session.expires_at! * 1000).toLocaleString()
          });
          
          // 인증 상태 쿠키 설정 (클라이언트에서 사용 가능)
          res.cookies.set(authStatusCookie, 'authenticated', {
            maxAge: 60 * 60 * 24 * 7, // 7일
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          });
        }
      } catch (refreshError) {
        console.error('🔍 세션 갱신 중 예외 발생:', refreshError);
      }
    }
  } else {
    // 세션이 없는 경우 인증 상태 쿠키 제거
    res.cookies.set(authStatusCookie, '', { maxAge: 0, path: '/' });
  }

  // 보호된 라우트 목록
  const protectedRoutes = PROTECTED_ROUTES;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminRoute = pathname.startsWith('/admin');
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => pathname.startsWith(route));

  // 미인증 상태에서의 처리
  if (!session) {
    console.log('🔍 세션 없음, 경로 체크:', pathname);
    
    // 보호된 API 경로는 401 에러 반환
    if (isProtectedApi) {
      console.log('🔍 보호된 API 접근 시도, 401 반환');
      return NextResponse.json(
        { error: 'Authentication required', code: 'auth/unauthorized' },
        { status: 401 }
      );
    }
    
    // 관리자 경로는 항상 로그인으로 리다이렉트
    if (isAdminRoute) {
      console.log('🔍 관리자 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 다른 보호된 경로도 로그인으로 리다이렉트
    if (isProtectedRoute) {
      console.log('🔍 보호된 경로 접근 시도, 로그인으로 리다이렉트');
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
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
    // 모든 경로에 대해 적용 (정적 파일 제외는 코드 내에서 처리)
    '/((?!_next/static|_next/image|favicon.ico|assets).*)',
  ],
}; 