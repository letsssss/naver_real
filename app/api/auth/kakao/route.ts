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
              cookieStore.set(name, value, options);
            } catch (error) {
              // API 라우트에서 쿠키 설정 실패 시 에러 로깅
              console.error('쿠키 설정 실패:', error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              console.error('쿠키 삭제 실패:', error);
            }
          },
        },
      }
    );
    
    // 카카오 OAuth 로그인 시작
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    
    if (error) {
      console.error('카카오 로그인 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    console.log('🔑 카카오 인증 URL 생성 성공:', data.url);
    return NextResponse.json({ url: data.url }, { status: 200 });
  } catch (error: any) {
    console.error('카카오 로그인 처리 중 예외 발생:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 