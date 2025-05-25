import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase.types';

export async function POST(req: Request) {
  console.log('📨 API 콜백 POST 요청 수신');
  
  try {
    const requestUrl = new URL(req.url);
    const supabase = createRouteHandlerClient<Database>({ cookies });

    const { event, session } = await req.json();
    
    console.log('🔍 수신된 이벤트:', event);
    console.log('🔍 세션 데이터:', session ? '있음' : '없음');

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      console.log('✅ 세션 설정 중...');
      
      // Supabase auth-helpers가 자동으로 쿠키 설정해줌
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      
      console.log('✅ 세션 쿠키 업데이트 완료');
    }

    // 리다이렉트 대신 JSON 응답 반환
    return NextResponse.json({ 
      success: true, 
      message: "Session cookies updated" 
    });
    
  } catch (error) {
    console.error('❌ API 콜백 처리 중 오류:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET 요청도 처리 (혹시 모를 경우를 대비)
export async function GET(req: Request) {
  console.log('📨 API 콜백 GET 요청 수신 - /auth/callback로 리디렉션');
  
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  
  // GET 요청은 /auth/callback으로 리디렉션
  const redirectUrl = `/auth/callback?code=${code}&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(redirectUrl, url.origin));
} 