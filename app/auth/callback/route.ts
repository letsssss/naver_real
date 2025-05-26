import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  console.log('🔄 OAuth 콜백 라우트 시작');
  
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  
  console.log('📋 콜백 파라미터:', { 
    code: code ? '존재함' : '없음', 
    next,
    fullUrl: request.url,
    origin
  });

  if (code) {
    console.log('✅ Authorization code 발견, 세션 교환 시작');
    
    try {
      // Next.js 14 호환 방식으로 Supabase 클라이언트 생성
      const supabase = createRouteHandlerClient({ cookies });
      
      // Next.js 14 버그 해결: cookies 강제 로드
      console.log('🍪 쿠키 강제 로드 (Next.js 14 버그 해결)');
      const cookieStore = await cookies();
      cookieStore.getAll();

      console.log('🔑 Supabase 클라이언트 생성 완료, 세션 교환 시작');
      
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      // 세션 교환 후에도 쿠키 다시 로드
      cookieStore.getAll();
      
      console.log('📊 세션 교환 결과:', {
        hasData: !!data,
        hasSession: !!data?.session,
        hasUser: !!data?.session?.user,
        error: error ? {
          message: error.message,
          status: error.status
        } : null
      });
      
      if (!error && data?.session) {
        console.log('✅ 세션 생성 성공:', {
          userId: data.session.user.id,
          email: data.session.user.email,
          provider: data.session.user.app_metadata?.provider
        });
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        console.error('❌ 세션 생성 실패:', error);
        const errorMessage = error?.message || 'Unknown error';
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`);
      }
    } catch (err) {
      console.error('❌ 콜백 처리 중 예외 발생:', err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent('Callback processing failed')}`);
    }
  }

  console.error('❌ Authorization code가 없음');
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_code`);
} 