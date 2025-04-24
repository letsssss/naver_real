import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { User } from '@/types/supabase.types';

export async function getAuthUser(request: NextRequest): Promise<User | null> {
  const client = getSupabaseClient();
  const allCookies = request.cookies.getAll();
  const cookieMap = Object.fromEntries(allCookies.map(c => [c.name, c.value]));

  const bearer = request.headers.get('Authorization')?.replace('Bearer ', '');
  const cookieToken = cookieMap['access_token'] || cookieMap['sb-jdubrjczdyqqtsppojgu-auth-token'];

  const token = bearer || cookieToken;

  if (token) {
    try {
      const { data: { user }, error } = await client.auth.getUser(token);
      if (user) {
        const { data: userData, error: userError } = await client
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!userError && userData) {
          return {
            id: user.id,
            email: user.email || '',
            name: userData?.name || user.user_metadata?.name || '',
            role: userData?.role || user.user_metadata?.role || 'USER'
          };
        }
      }
    } catch (e) {
      console.error('토큰 인증 실패:', e);
    }
  }

  // ✅ 개발 환경일 경우 쿼리 파라미터 허용
  if (process.env.NODE_ENV === 'development') {
    const url = new URL(request.url);
    const devId = url.searchParams.get('userId');
    if (devId) {
      return {
        id: devId,
        email: 'dev@example.com',
        name: '개발자',
        role: 'USER',
      };
    }
  }

  // 마지막 fallback: Supabase 세션 확인
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || '',
        role: session.user.user_metadata?.role || 'USER'
      };
    }
  } catch (e) {
    console.error('세션 확인 실패:', e);
  }

  return null;
} 