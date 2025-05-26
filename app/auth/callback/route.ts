import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);

    const code = searchParams.get('code');
    let next = searchParams.get('next') ?? '/';

    // next가 절대 경로인지 간단히 확인
    if (!next.startsWith('/')) {
      next = '/';
    }

    if (!code) {
      console.error('[Auth Callback] code parameter missing');
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_code`);
    }

    const supabase = await createClient();

    // 인증 코드로 세션 교환
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] exchangeCodeForSession error:', error);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
    }

    if (!data || !data.session) {
      console.error('[Auth Callback] No session returned from exchangeCodeForSession');
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_session`);
    }

    // 성공 시 리다이렉트 경로 결정
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';

    let redirectUrl = '';

    if (isLocalEnv) {
      redirectUrl = `${origin}${next}`;
    } else if (forwardedHost) {
      redirectUrl = `https://${forwardedHost}${next}`;
    } else {
      redirectUrl = `${origin}${next}`;
    }

    console.log('[Auth Callback] Redirecting to:', redirectUrl);

    return NextResponse.redirect(redirectUrl);

  } catch (err) {
    console.error('[Auth Callback] Unexpected error:', err);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=unexpected_error`);
  }
}