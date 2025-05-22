'use client';

import { useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase-client';

/**
 * 인증 상태 변경을 감지하는 컴포넌트
 * 디버깅 용도로 사용하며, 실제 상태 관리는 AuthProvider에서 수행
 */
export default function AuthListener() {
  useEffect(() => {
    const supabase = getBrowserClient();
    
    // 세션 상태 모니터링 (디버깅용)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth 이벤트:', event);
        console.log('🔄 세션 상태:', session ? '있음' : '없음');
        
        if (session) {
          console.log('🔄 사용자:', session.user.email);
          console.log('🔄 만료 시간:', new Date(session.expires_at! * 1000).toLocaleString());
          console.log('🔄 만료까지 남은 시간:', Math.round((session.expires_at! * 1000 - Date.now()) / 1000 / 60), '분');
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // UI를 렌더링하지 않음
  return null;
} 