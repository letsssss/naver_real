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
              cookieStore.set(name, value, options);
            } catch (error) {
              console.error('콜백 처리 중 쿠키 설정 실패:', error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              console.error('콜백 처리 중 쿠키 삭제 실패:', error);
            }
          },
        },
      }
    );
    
    // 코드를 세션으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('세션 교환 에러:', error);
      return NextResponse.redirect(`${origin}/login?error=auth_error`);
    }
    
    // 세션 정보 확인
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 세션 생성 성공:', session?.user.email);
    
    // 환경에 따른 리다이렉트 URL 설정
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    
    let finalRedirectUrl;
    if (isLocalEnv) {
      finalRedirectUrl = `${origin}${next}`;
    } else if (forwardedHost) {
      finalRedirectUrl = `https://${forwardedHost}${next}`;
    } else {
      finalRedirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || origin}${next}`;
    }
    
    console.log('🔐 리다이렉트:', finalRedirectUrl);
    return NextResponse.redirect(finalRedirectUrl);
  } catch (error: any) {
    console.error('콜백 처리 중 예외 발생:', error);
    return NextResponse.redirect(`${new URL(request.url).origin}/login?error=server_error`);
  }
} 