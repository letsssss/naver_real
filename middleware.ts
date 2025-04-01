import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 보호된 경로 목록
const PROTECTED_ROUTES = [
  '/proxy-ticketing',
  '/ticket-cancellation',
  '/tickets',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // API 경로인 경우 CORS 헤더 설정
  if (pathname.startsWith('/api')) {
    // API 요청은 자세한 로그 출력 안함
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Edge 브라우저 호환성을 위한 추가 헤더
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  }
  
  // 보호된 경로인지 확인
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  // 개발 환경인지 확인
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isProtectedRoute) {
    // 모든 환경에서 기존 토큰 확인
    const existingToken = request.cookies.get('auth-token')?.value;
    const existingNormalToken = request.cookies.get('token')?.value;
    const existingAuthStatus = request.cookies.get('auth-status')?.value;
    
    // 실제 토큰 있는지 확인 (테스트 토큰이 아닌 실제 토큰)
    const hasRealToken = (existingToken && existingToken !== 'dev-test-token') || 
                         (existingNormalToken && existingNormalToken !== 'dev-test-token');
    
    // 개발 환경에서는 토큰 검사 일시적으로 건너뛰기
    if (isDevelopment) {
      // Next.js 응답에 토큰과 인증 상태 강제 설정
      const response = NextResponse.next();
      
      // 실제 토큰이 있으면 그대로 유지하고 테스트 토큰으로 덮어쓰지 않음
      if (hasRealToken) {
        console.log(`개발 환경: 실제 토큰 감지됨. 테스트 토큰을 사용하지 않음.`);
        
        // 캐시 방지 헤더 추가
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        
        return response;
      }
      
      // 개발 환경 로그는 한 번만 출력
      console.log(`개발 환경 접근 허용: ${pathname}`);
      
      // 세션 쿠키 설정 (쿠키가 없는 경우만)
      if (!existingToken) {
        const testToken = "dev-test-token";
        response.cookies.set('auth-token', testToken, {
          httpOnly: true,
          secure: false, // 개발 환경에서는 false
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30일 (장기 유지)
          path: '/',
        });
        
        // 클라이언트측 쿠키도 설정 (JavaScript에서 접근 가능)
        response.cookies.set('token', testToken, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
      
      // 인증 상태 설정 (쿠키가 없는 경우만)
      if (!existingAuthStatus) {
        response.cookies.set('auth-status', 'authenticated', {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
      
      // 캐시 방지 헤더 추가
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }
    
    // 쿠키에서 토큰 확인
    const token = request.cookies.get('auth-token')?.value;
    const authStatus = request.cookies.get('auth-status')?.value;
    
    // 추가로 일반 'token' 쿠키도 확인
    const normalToken = request.cookies.get('token')?.value;
    
    console.log(`인증 상태: auth-token=${token ? '있음' : '없음'}, token=${normalToken ? '있음' : '없음'}, auth-status=${authStatus || '없음'}`);
    
    // 토큰이 없거나 auth-status가 'authenticated'가 아니면 로그인 페이지로 리다이렉트
    if ((!token && !normalToken) || authStatus !== 'authenticated') {
      console.log(`접근 제한: ${pathname} - 유효한 인증 정보 없음`);
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      
      // 로그인 페이지로 리다이렉트하는 응답
      const response = NextResponse.redirect(url);
      
      // 토큰이 있는데 auth-status가 없는 경우 토큰을 기반으로 auth-status 설정
      if ((token || normalToken) && !authStatus) {
        response.cookies.set('auth-status', 'authenticated', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7일 (초 단위)
          path: '/',
        });
      }
      
      return response;
    }
    
    // 토큰이 있는 경우에도 응답에 토큰이 있는지 확인하고 유지
    const response = NextResponse.next();
    
    // 토큰 쿠키 설정 (둘 중 하나가 있으면 유지)
    const effectiveToken = token || normalToken;
    if (effectiveToken) {
      // auth-token 쿠키 설정
      response.cookies.set('auth-token', effectiveToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 연장: 30일 (테스트용)
        path: '/',
      });
      
      // token 쿠키도 설정 (클라이언트 스크립트가 접근할 수 있도록)
      response.cookies.set('token', effectiveToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 연장: 30일 (테스트용)
        path: '/',
      });
    }
    
    // auth-status 쿠키 설정 (클라이언트에서 읽을 수 있게 httpOnly 아님)
    if (authStatus === 'authenticated') {
      response.cookies.set('auth-status', 'authenticated', {
        httpOnly: false, // 클라이언트에서 읽을 수 있도록 함
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 연장: 30일 (테스트용)
        path: '/',
      });
    }
    
    console.log(`인증 토큰 및 상태 확인됨: ${pathname}`);
    
    // 캐시 방지 헤더 추가
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  }
  
  return NextResponse.next();
}

// 미들웨어를 적용할 경로 설정
export const config = {
  matcher: [
    '/api/:path*',
    '/proxy-ticketing/:path*',
    '/ticket-cancellation/:path*', 
    '/tickets/:path*'
  ],
}; 