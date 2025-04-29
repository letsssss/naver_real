'use client';

import { useEffect } from 'react';
import supabase from '@/lib/supabase/client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  useEffect(() => {
    // 기존 supabase 클라이언트
    const supabaseClient = supabase;
    
    // 브라우저 전용 Supabase 클라이언트 생성
    const browserClient = createClientComponentClient();
    
    const { data: listener } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 인증 상태 변경:', event, session ? '세션 있음' : '세션 없음');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
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
          
          // Supabase의 인증 쿠키를 자동으로 설정하게끔 강제로 trigger
          try {
            const response = await fetch('/api/auth/callback', {
              method: 'POST',
              body: JSON.stringify({ event, session }),
              headers: { 'Content-Type': 'application/json' },
            });
            
            // 리다이렉트된 응답을 무시 (리다이렉트가 루트 경로로 발생하는 문제 해결)
            if (!response.redirected) {
              console.log("✅ Supabase 쿠키 설정 API 호출 완료");
            } else {
              console.log("⚠️ 리다이렉트 감지됨, 무시합니다");
            }
          } catch (error) {
            console.error("❌ Supabase 쿠키 설정 API 호출 실패:", error);
          }
        } else {
          console.warn("❗ TokenRefresher에서 INITIAL_SESSION 발생했지만 session은 없음");
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