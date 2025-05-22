import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';
import { cookies } from 'next/headers';

/**
 * OAuth 콜백 처리 API 엔드포인트
 * @route GET /api/auth/callback
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') || '/';
    const cookieStore = cookies();
    
    console.log('🔐 OAuth 콜백 처리 중:', { code: !!code, next });
    
    if (!code) {
      console.error('OAuth 인증 코드 없음');
      return NextResponse.redirect(`${origin}/login?error=missing_code`);
    }
    
    // Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            try {
              // 쿠키 보안 설정 강화
              cookieStore.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === 'production',
                httpOnly: false, // false로 변경하여 클라이언트에서 접근 가능하게 함
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7, // 7일간 유효하도록 설정
              });
            } catch (error) {
              console.error('콜백 처리 중 쿠키 설정 실패:', error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { 
                ...options, 
                maxAge: 0,
                secure: process.env.NODE_ENV === 'production',
                httpOnly: false, // false로 변경
                sameSite: 'lax',
                path: '/',
              });
            } catch (error) {
              console.error('콜백 처리 중 쿠키 삭제 실패:', error);
            }
          },
        },
      }
    );
    
    // 코드를 세션으로 교환
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      console.error('세션 교환 에러:', sessionError);
      return NextResponse.redirect(`${origin}/login?error=auth_error&message=${encodeURIComponent(sessionError.message)}`);
    }
    
    // 세션 데이터가 있는지 확인
    if (!sessionData?.session) {
      console.error('exchangeCodeForSession 후 세션 객체가 없음');
    } else {
      console.log('🔐 exchangeCodeForSession 성공:', {
        userId: sessionData.session.user.id.substring(0, 6) + '...',
        email: sessionData.session.user.email,
        expiresAt: new Date(sessionData.session.expires_at! * 1000).toLocaleString()
      });
    }
    
    // 세션 정보 다시 확인
    const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
    
    if (getSessionError) {
      console.error('getSession 에러:', getSessionError);
    }
    
    if (!session) {
      console.error('세션 생성 실패: 세션 객체가 없음');
      return NextResponse.redirect(`${origin}/login?error=session_error`);
    }
    
    // 세션 디버깅 정보 출력
    console.log('🔐 세션 생성 성공:', {
      provider: session.user.app_metadata.provider, 
      email: session.user.email,
      userId: session.user.id.substring(0, 6) + '...',
      expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
    });
    
    // 환경에 따른 리다이렉트 URL 설정
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    
    let baseUrl;
    if (isLocalEnv) {
      baseUrl = origin;
    } else if (forwardedHost) {
      baseUrl = `https://${forwardedHost}`;
    } else {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
    }
    
    // 세션 토큰을 URL 쿼리 파라미터로 추가
    // 이를 통해 클라이언트에서 세션을 복원할 수 있음
    const sessionToken = session.access_token;
    const refreshToken = session.refresh_token;
    const encodedAccessToken = encodeURIComponent(sessionToken || '');
    const encodedRefreshToken = encodeURIComponent(refreshToken || '');
    
    const finalRedirectUrl = `${baseUrl}${next}?access_token=${encodedAccessToken}&refresh_token=${encodedRefreshToken}`;
    console.log('🔐 리다이렉트 준비:', { url: baseUrl + next });
    
    // 리다이렉트 응답 생성
    const response = NextResponse.redirect(finalRedirectUrl);
    
    // 세션 정보를 클라이언트 쿠키에 복사
    const supabaseCookies = cookieStore.getAll();
    let copiedCookieCount = 0;
    
    supabaseCookies.forEach((cookie) => {
      if (cookie.name.includes('supabase') || cookie.name.includes('auth') || cookie.name.includes('sb-')) {
        console.log(`🍪 클라이언트에 쿠키 복사: ${cookie.name}`);
        response.cookies.set(cookie.name, cookie.value, {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: false, // JavaScript에서 접근 가능하도록 false로 설정
          maxAge: 60 * 60 * 24 * 7, // 7일간 유효
        });
        copiedCookieCount++;
      }
    });
    
    console.log(`🍪 총 ${copiedCookieCount}개의 쿠키를 클라이언트에 복사함`);
    
    return response;
  } catch (error: any) {
    console.error('콜백 처리 중 예외 발생:', error);
    const errorMessage = encodeURIComponent(error.message || 'Unknown error');
    return NextResponse.redirect(`${new URL(request.url).origin}/login?error=server_error&message=${errorMessage}`);
  }
} 