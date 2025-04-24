'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  useEffect(() => {
    const supabase = createBrowserClient();
    
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 인증 상태 변경:', event, session ? '세션 있음' : '세션 없음');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          console.log("✅ 세션 갱신됨 또는 로그인 완료", {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
          });
          
          // 세션을 로컬에 저장
          localStorage.setItem('supabase.auth.token', JSON.stringify(session));
          
          // 추가: 다른 인증 관련 키도 동기화
          localStorage.setItem('token', session.access_token);
          localStorage.setItem('auth-token', session.access_token);
          
          // 쿠키에도 저장 (httpOnly 아님)
          const maxAge = 30 * 24 * 60 * 60; // 30일
          document.cookie = `auth-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `auth-status=authenticated; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log("🚪 로그아웃됨, 세션 제거");
        
        // localStorage에서 모든 인증 관련 키 제거
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('token');
        localStorage.removeItem('auth-token');
        localStorage.removeItem('user');
        
        // 쿠키 제거
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'auth-status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      
      // 세션 상태 로깅
      const authKeys = Object.keys(localStorage).filter(k => 
        k.includes('token') || k.includes('supabase') || k.includes('auth')
      );
      console.log('현재 localStorage 인증 키:', authKeys);
    });

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
} 