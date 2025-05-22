import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';
import { cookies } from 'next/headers';

/**
 * 카카오 로그인 API 엔드포인트
 * @route GET /api/auth/kakao
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const next = searchParams.get('next') || '/';
    const cookieStore = cookies();
    
    console.log('🔑 카카오 로그인 요청 처리 중:', { next });
    
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
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
              });
            } catch (error) {
              // API 라우트에서 쿠키 설정 실패 시 에러 로깅
              console.error('쿠키 설정 실패:', error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { 
                ...options, 
                maxAge: 0,
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
              });
            } catch (error) {
              console.error('쿠키 삭제 실패:', error);
            }
          },
        },
      }
    );
    
    // 리다이렉트 URL 설정
    // vercel 배포 환경을 고려하여 site URL 또는 origin 사용
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
    const redirectUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;
    
    console.log('🔑 리다이렉트 URL:', redirectUrl);
    
    // 카카오 OAuth 로그인 시작
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: redirectUrl,
        scopes: 'profile_nickname profile_image account_email', // 필요한 스코프 추가
        queryParams: {
          'single_account': 'true' // 하나의 계정만 허용
        }
      },
    });
    
    if (error) {
      console.error('카카오 로그인 에러:', error);
      return NextResponse.json(
        { error: `카카오 로그인 오류: ${error.message}` }, 
        { status: 400 }
      );
    }
    
    if (!data?.url) {
      return NextResponse.json(
        { error: '카카오 인증 URL을 가져올 수 없습니다' }, 
        { status: 500 }
      );
    }
    
    console.log('🔑 카카오 인증 URL 생성 성공:', data.url);
    return NextResponse.json({ url: data.url }, { status: 200 });
  } catch (error: any) {
    console.error('카카오 로그인 처리 중 예외 발생:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류') },
      { status: 500 }
    );
  }
} 