import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  // 🔍 강화된 로깅
  console.log('📩 콜백 진입:', url.toString());
  console.log('✅ code:', code);
  console.log('🔍 카카오 OAuth 콜백 처리 시작');
  console.log('받은 코드:', code ? '있음' : '없음');
  console.log('리디렉션 대상:', next);

  if (!code) {
    console.error('❌ 인증 코드가 없습니다');
    return NextResponse.redirect(`${url.origin}/auth/error?reason=no-code`);
  }

  try {
    const supabase = createServerSupabaseClient();
    
    console.log('🔄 exchangeCodeForSession 실행 중...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ 세션 교환 실패:', error.message);
      console.error('오류 상세:', error);
      
      // 구체적인 오류 처리
      let errorReason = 'exchange-fail';
      if (error.message.includes('invalid_grant')) {
        errorReason = 'invalid-code';
      } else if (error.message.includes('expired')) {
        errorReason = 'code-expired';
      }
      
      return NextResponse.redirect(`${url.origin}/auth/error?reason=${errorReason}&message=${encodeURIComponent(error.message)}`);
    }

    if (!data.session) {
      console.error('❌ 세션이 생성되지 않았습니다');
      return NextResponse.redirect(`${url.origin}/auth/error?reason=no-session`);
    }

    console.log('✅ 세션 교환 성공!');
    console.log('사용자 ID:', data.session.user.id);
    console.log('사용자 이메일:', data.session.user.email);
    console.log('세션 만료 시간:', new Date(data.session.expires_at! * 1000).toISOString());

    // 성공적으로 로그인 완료 - 홈페이지로 리디렉션
    const response = NextResponse.redirect(`${url.origin}${next}`);
    
    // 추가 보안을 위해 응답 헤더에 성공 표시
    response.headers.set('X-Auth-Success', 'true');
    
    return response;
    
  } catch (err: any) {
    console.error('❌ 예외 발생:', err);
    console.error('스택 트레이스:', err.stack);
    
    return NextResponse.redirect(`${url.origin}/auth/error?reason=server-error&message=${encodeURIComponent(err.message)}`);
  }
} 