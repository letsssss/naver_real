import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  console.log('🔄 OAuth 콜백 라우트 시작');
  
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  
  console.log('📋 콜백 파라미터:', { code: code ? '존재함' : '없음', next });

  if (code) {
    console.log('✅ Authorization code 발견, 세션 교환 시작');
    
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.session) {
      console.log('✅ 세션 생성 성공:', data.session.user.email);
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error('❌ 세션 생성 실패:', error);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error?.message || 'Unknown error')}`);
    }
  }

  console.error('❌ Authorization code가 없음');
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_code`);
} 