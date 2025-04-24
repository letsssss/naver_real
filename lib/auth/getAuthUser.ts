import { NextRequest } from 'next/server';
import { createTokenClient, getSupabaseClient } from '@/lib/supabase';
import { User } from '@/types/supabase.types';

export async function getAuthUser(request: NextRequest): Promise<User | null> {
  try {
    // Authorization 헤더 → 쿠키 순으로 토큰 가져오기
    const bearer = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cookie = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token');
    let token: string | undefined;

    if (bearer) {
      token = bearer;
    } else if (cookie?.value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookie.value));
        token = parsed?.access_token;
      } catch (e) {
        console.warn('쿠키 파싱 실패:', e);
      }
    }

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

    // 개발환경 예외 허용
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
    console.error('getAuthUser 오류:', e);
    return null;
  }
} 