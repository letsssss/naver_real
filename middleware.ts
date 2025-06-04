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

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // 1. 먼저 Authorization 헤더에서 토큰 확인
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');
  
  // 2. 쿠키에서도 토큰 확인
  const authCookieValue = req.cookies.get(authCookie)?.value;
  let cookieToken = null;
  
  if (authCookieValue) {
    try {
      const cookieData = JSON.parse(authCookieValue);
      cookieToken = cookieData.access_token;
    } catch (e) {
      // 쿠키 파싱 실패 시 무시
    }
  }
  
  // 3. 사용할 토큰 결정 (헤더 우선, 쿠키 대안)
  const token = bearerToken || cookieToken;
  
  if (token) {
    // Admin 클라이언트로 토큰 검증
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey) {
        return handleAuthFailure(req);
      }
      
      // Admin 클라이언트로 토큰 검증
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      
      if (error || !user) {
        // 토큰 검증 실패 시 기존 방식으로 폴백
        const supabase = createMiddlewareClient({ req, res });
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          return handleAuthFailure(req);
        }
        
        return handleAuthenticatedRequest(req, res, session, session.user);
      }
      
      // 세션 객체 구성
      const session = {
        access_token: token,
        user: user,
        expires_at: Math.floor(Date.now() / 1000) + (60 * 60)
      };
      
      return handleAuthenticatedRequest(req, res, session, user);
      
    } catch (tokenError) {
      // 오류 발생 시 기존 방식으로 폴백
    }
  }
  
  // 4. 토큰이 없거나 검증 실패 시 기존 방식 사용
  const supabase = createMiddlewareClient({ req, res });

  try {
    // 세션 새로고침
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return handleAuthFailure(req);
    }

    return handleAuthenticatedRequest(req, res, session, session?.user);
  } catch (error) {
    return handleAuthFailure(req);
  }
}

// 인증된 요청 처리 로직을 별도 함수로 분리
function handleAuthenticatedRequest(req: NextRequest, res: NextResponse, session: any, user: any) {
  // 세션이 있는 경우 인증 관련 쿠키 설정
  if (session && user) {
    // Supabase 세션 쿠키 설정
    res.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user || user
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    // 인증 상태 쿠키 설정
    res.cookies.set('auth-status', 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    // 사용자 정보 쿠키 설정
    res.cookies.set('user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || '사용자',
      role: user.user_metadata?.role || 'USER'
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    // Supabase 토큰 타입 쿠키 설정
    res.cookies.set(`sb-${projectRef}-auth-token-type`, 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });
  }

  // API 요청에 대한 인증 처리
  if (req.nextUrl.pathname.startsWith('/api/')) {
    if (!session || !user) {
      return new NextResponse(
        JSON.stringify({ error: '로그인이 필요합니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return res;
  }

  // 보호된 라우트 확인
  const isProtectedRoute = PROTECTED_ROUTES.some(route => req.nextUrl.pathname.startsWith(route));
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
  const isProtectedApiRoute = PROTECTED_API_ROUTES.some(route => req.nextUrl.pathname.startsWith(route));

  // ✅ 인증이 필요한 경로에서 세션이 없는 경우
  if (!session && (isProtectedRoute || isProtectedApiRoute)) {
    // API 경로는 401 응답
    if (isProtectedApiRoute) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // 페이지 경로는 로그인으로 리다이렉트
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    
    const response = NextResponse.redirect(redirectUrl);
    
    // 모든 인증 관련 쿠키 제거
    response.cookies.set('auth-status', '', { 
      expires: new Date(0),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    response.cookies.set('user', '', {
      expires: new Date(0),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    response.cookies.set(`sb-${projectRef}-auth-token`, '', {
      expires: new Date(0),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    response.cookies.set(`sb-${projectRef}-auth-token-type`, '', {
      expires: new Date(0),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    return response;
  }

  return res;
}

// 인증 실패 처리 함수
function handleAuthFailure(req: NextRequest) {
  const redirectUrl = new URL('/login', req.url);
  redirectUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
  
  const response = NextResponse.redirect(redirectUrl);
  
  // 모든 인증 관련 쿠키 제거
  response.cookies.set('auth-status', '', {
    expires: new Date(0),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  response.cookies.set('user', '', {
    expires: new Date(0),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  response.cookies.set(`sb-${projectRef}-auth-token`, '', {
    expires: new Date(0),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  response.cookies.set(`sb-${projectRef}-auth-token-type`, '', {
    expires: new Date(0),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  return response;
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