'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase.types'

// 브라우저에서 사용할 Supabase 클라이언트 생성
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    // 브라우저 쿠키 옵션 설정
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 7일간 유효
    }
  }
)

// 세션 상태 확인
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('세션 로드 오류:', error.message);
  } else {
    console.log('세션 상태:', data.session ? '있음' : '없음');
    
    if (data.session) {
      const expiresAt = new Date(data.session.expires_at! * 1000);
      console.log('세션 만료 시간:', expiresAt.toLocaleString());
      
      // 만료 시간이 24시간 이내인 경우 토큰 갱신 시도
      const timeUntilExpiry = expiresAt.getTime() - Date.now();
      if (timeUntilExpiry < 24 * 60 * 60 * 1000) {
        console.log('토큰 갱신 시도 중...');
        supabase.auth.refreshSession();
      }
    }
  }
}); 