import { NextRequest } from 'next/server';
import { createTokenClient, getSupabaseClient } from '@/lib/supabase';
import { User } from '@/types/supabase.types';

/**
 * Supabase 기반 사용자 인증 유틸리티
 * - Authorization → 쿠키 → Supabase 세션 순으로 인증
 */
export async function getAuthUser(request: NextRequest): Promise<User | null> {
  try {
    // 1️⃣ Authorization 헤더 우선
    const bearer = request.headers.get('Authorization')?.replace('Bearer ', '');

    // 2️⃣ Supabase 쿠키 접근
    const cookie = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token');
    let token: string | undefined;

    if (bearer) {
      token = bearer;
    } else if (cookie?.value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookie.value));
        token = parsed?.access_token;
      } catch (e) {
        console.warn('⚠️ 쿠키 파싱 실패:', e);
      }
    }

    // 3️⃣ 토큰 인증 시도
    if (token) {
      const client = createTokenClient(token);
      const { data: { user }, error } = await client.auth.getUser();
      if (user) {
        const { data: userData } = await client
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        return {
          id: user.id,
          email: user.email || '',
          name: userData?.name || user.user_metadata?.name || '',
          role: userData?.role || user.user_metadata?.role || 'USER',
        };
      }
    }

    // 4️⃣ Supabase 세션 fallback
    const sessionClient = getSupabaseClient();
    const { data: { session }, error: sessionError } = await sessionClient.auth.getSession();
    if (session?.user) {
      const { data: userData } = await sessionClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      return {
        id: session.user.id,
        email: session.user.email || '',
        name: userData?.name || session.user.user_metadata?.name || '',
        role: userData?.role || session.user.user_metadata?.role || 'USER',
      };
    }

    // 5️⃣ 개발 환경용 예외 허용 (URL 쿼리)
    if (process.env.NODE_ENV === 'development') {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      if (userId) {
        return {
          id: userId,
          email: 'dev@example.com',
          name: '개발자',
          role: 'USER',
        };
      }
    }

    return null;
  } catch (e) {
    console.error('❌ getAuthUser 오류:', e);
    return null;
  }
} 