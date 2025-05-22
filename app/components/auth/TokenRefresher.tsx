'use client';

import { useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase-client';
import { createBrowserClient } from '@supabase/ssr';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 * 세션 상태 변화를 감지하고 디버깅 정보를 제공합니다.
 */
export default function TokenRefresher() {
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authListenerRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    // 새로운 브라우저 클라이언트 생성
    const supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    console.log('🔄 TokenRefresher 마운트');
    
    // 토큰 갱신 함수
    const refreshToken = async () => {
      try {
        const { data, error } = await supabaseClient.auth.refreshSession();
        
        if (error) {
          console.error('🔄 토큰 갱신 실패:', error.message);
          return false;
        }
        
        if (data.session) {
          const expiresAt = new Date(data.session.expires_at! * 1000);
          console.log('🔄 토큰 갱신 성공:', expiresAt.toLocaleString());
          
          // 다음 갱신 시간 설정 (만료 시간 10분 전)
          const nextRefreshIn = Math.max(
            0,
            data.session.expires_at! * 1000 - Date.now() - 10 * 60 * 1000
          );
          
          console.log(`🔄 다음 갱신 예정: ${Math.floor(nextRefreshIn / 1000 / 60)}분 후`);
          
          // 이전 타이머 취소 후 새 타이머 설정
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          
          refreshTimerRef.current = setTimeout(refreshToken, nextRefreshIn);
          return true;
        }
        
        return false;
      } catch (err) {
        console.error('🔄 토큰 갱신 중 예외 발생:', err);
        return false;
      }
    };
    
    // 초기 세션 확인 및 갱신 타이머 설정
    const initSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      console.log('🔄 TokenRefresher 초기 세션:', session ? '있음' : '없음');
      
      if (session) {
        const expiresAt = session.expires_at! * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        console.log('🔄 초기 세션 정보:', {
          userId: session.user.id,
          email: session.user.email,
          expiresAt: new Date(expiresAt).toLocaleString(),
          timeUntilExpiry: `${Math.floor(timeUntilExpiry / 1000 / 60)}분`
        });
        
        // 세션이 60분 이내에 만료되는 경우 즉시 갱신
        if (timeUntilExpiry < 60 * 60 * 1000) {
          console.log('🔄 세션 만료 시간이 가까움, 즉시 갱신 시도');
          await refreshToken();
        } else {
          // 만료 10분 전에 갱신 타이머 설정
          const refreshIn = timeUntilExpiry - 10 * 60 * 1000;
          console.log(`🔄 갱신 타이머 설정: ${Math.floor(refreshIn / 1000 / 60)}분 후`);
          refreshTimerRef.current = setTimeout(refreshToken, refreshIn);
        }
      } else {
        console.log('🔄 인증된 세션 없음, 토큰 갱신 타이머 설정 안 함');
      }
    };
    
    // 인증 상태 변경 감지
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 인증 상태 변경:', event, session ? '세션 있음' : '세션 없음');
      
      if (event === 'SIGNED_IN') {
        if (session) {
          console.log("✅ 로그인 완료", {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
          });
          
          // 로그인 시 갱신 타이머 설정
          const expiresAt = session.expires_at! * 1000;
          const refreshIn = Math.max(0, expiresAt - Date.now() - 10 * 60 * 1000);
          
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          
          refreshTimerRef.current = setTimeout(refreshToken, refreshIn);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (session) {
          console.log("✅ 토큰 갱신됨", {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
          });
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("🚪 로그아웃됨");
        
        // 로그아웃 시 타이머 취소
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
      
      // 세션/쿠키 상태 로깅
      if (event !== 'INITIAL_SESSION') {
        console.log(`🍪 쿠키 정보: ${document.cookie}`);
      }
    });
    
    // 저장된 리스너 참조
    authListenerRef.current = subscription;
    
    // 초기 세션 확인 및 갱신 타이머 설정
    initSession();

    // 컴포넌트 언마운트 시 리스너 및 타이머 정리
    return () => {
      console.log('🔄 TokenRefresher 언마운트');
      
      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe();
      }
      
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return null;
} 