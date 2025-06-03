'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
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
          
          // 기존 Supabase 키가 있다면 통합
          const supabaseKey = Object.keys(localStorage).find(key =>
            key.startsWith('sb-') && key.endsWith('-auth-token')
          );
          
          if (supabaseKey) {
            // 기존 Supabase 키에도 일관된 형식으로 저장
            // 이미 JSON 객체가 저장된 경우 최신 access_token으로 업데이트
            try {
              const existingData = localStorage.getItem(supabaseKey);
              if (existingData && !existingData.startsWith('eyJ')) {
                // JSON 객체인 경우 업데이트
                try {
                  const parsed = JSON.parse(existingData);
                  parsed.access_token = session.access_token;
                  localStorage.setItem(supabaseKey, JSON.stringify(parsed));
                  console.log("✅ 기존 Supabase 키 JSON 객체 업데이트됨");
                } catch (e) {
                  // 파싱 실패 시 덮어쓰기
                  localStorage.setItem(supabaseKey, JSON.stringify(session));
                  console.log("✅ 기존 Supabase 키 덮어쓰기됨 (파싱 실패)");
                }
              } else {
                // 직접 토큰이 저장된 경우 세션 객체로 덮어쓰기
                localStorage.setItem(supabaseKey, JSON.stringify(session));
                console.log("✅ 기존 Supabase 키 세션 객체로 덮어쓰기됨");
              }
            } catch (e) {
              console.error("❌ Supabase 키 업데이트 중 오류:", e);
            }
          }
          
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