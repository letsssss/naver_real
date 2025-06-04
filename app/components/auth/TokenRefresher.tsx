"use client";

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      try {
        const supabase = await getSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          await refreshUser();
        }
      } catch (error) {
        // 토큰 새로고침 오류 처리
      }
    };

    // 5분마다 토큰 새로고침 확인
    const interval = setInterval(refreshToken, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  return null; // UI 렌더링 없음
} 